// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./TicketNFT.sol";
import "./RoyaltySplitter.sol";

/// Venda primária. Um `Event` agrupa N `TicketType` (área × dia × lote), conforme
/// PLANO_EVOLUCAO_V2.md §5.1/§5.2 — decisão A1, opção (a), fechada em 2026-08-04.
///
/// Por que os tipos vivem *dentro* do Event, e não como um Event on-chain por tipo
/// (opção 5.2b): `createEvent` deploya um `RoyaltySplitter` por evento. Um evento por
/// tipo multiplicaria esse deploy pelo número de tipos — 12 splitters idênticos para um
/// evento de 2 dias × 2 áreas × 3 lotes — e espalharia o royalty do organizador por 12
/// endereços de saque. Aqui o splitter continua sendo um só por evento.
contract TicketSale is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    TicketNFT public immutable nft;
    address public platformWallet;

    struct Event {
        address organizer;
        address paymentToken;         // address(0) = ETH
        uint256 platformFeeBps;       // primary-sale platform cut (basis points)
        uint256 maxTickets;           // teto global do evento (todas as áreas/dias); 0 = ilimitado
        uint256 soldTickets;          // contador global; é o que numera o ingresso "#N"
        bool paused;
        string eventName;
        uint256 eventTimestamp;
        // ERC-2981 royalty config
        uint96 royaltyBps;            // total royalty % charged by external marketplaces
        address royaltySplitter;      // RoyaltySplitter deployed for this event
    }

    /// Uma célula da matriz área × dia × lote.
    struct TicketType {
        uint256 price;                // preço próprio; vira o `facePrice` do NFT (D26)
        uint256 maxTickets;           // cota do tipo; 0 = sem cota própria (só o teto do evento limita)
        uint256 soldTickets;
        uint256 salesEndAt;           // fim do lote por data; 0 = sem prazo próprio
        bool paused;
        string label;                 // "Pista — Dia 1 — Lote 2"; vira o `seat` do NFT
    }

    /// Parâmetros de criação de um tipo. Struct própria para `createEvent` receber a
    /// matriz inteira em uma única transação — é isso que mantém a aprovação de evento
    /// atômica (um `createEvent` que reverte não deixa tipo órfão on-chain).
    struct TicketTypeInput {
        uint256 price;
        uint256 maxTickets;
        uint256 salesEndAt;
        string label;
    }

    uint256 private _nextEventId;
    mapping(uint256 => Event) public events;

    mapping(uint256 => mapping(uint256 => TicketType)) public ticketTypes;
    mapping(uint256 => uint256) public ticketTypeCount;

    uint256 private constant BPS = 10_000;
    uint256 private constant SALE_GRACE_PERIOD = 2 hours;

    mapping(address => uint256) public pendingWithdrawals;

    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        uint256 maxTickets,
        address royaltySplitter
    );
    event TicketTypeAdded(
        uint256 indexed eventId,
        uint256 indexed typeId,
        uint256 price,
        uint256 maxTickets,
        string label
    );
    event TicketSold(
        uint256 indexed eventId,
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 typeId,
        uint256 amount
    );
    event EventPauseToggled(uint256 indexed eventId, bool paused);
    event TicketTypePauseToggled(uint256 indexed eventId, uint256 indexed typeId, bool paused);
    event PlatformWalletUpdated(address newWallet);
    event MaxTicketsUpdated(uint256 indexed eventId, uint256 newMax);
    event TicketTypeMaxUpdated(uint256 indexed eventId, uint256 indexed typeId, uint256 newMax);
    event TicketTypeSalesEndUpdated(uint256 indexed eventId, uint256 indexed typeId, uint256 newSalesEndAt);
    event Withdrawn(address indexed account, uint256 amount);

    constructor(address _nft, address _platformWallet) Ownable(msg.sender) {
        require(_nft != address(0) && _platformWallet != address(0), "Invalid address");
        nft = TicketNFT(_nft);
        platformWallet = _platformWallet;
    }

    // ─── Owner admin ───────────────────────────────────────────────────────────

    function setPlatformWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "Invalid wallet");
        platformWallet = _wallet;
        emit PlatformWalletUpdated(_wallet);
    }

    /// @param maxTickets            Teto global do evento (0 = ilimitado). As cotas dos tipos
    ///                              podem somar mais que isto de propósito — ex.: 3 lotes
    ///                              sequenciais da mesma área. Quem limita de fato é este teto.
    /// @param royaltyBps            Total royalty % that external marketplaces will pay (e.g. 500 = 5%)
    /// @param royaltyOrgShareBps    Organizer's cut of that royalty (e.g. 7000 = 70%, platform gets 30%)
    /// @param types                 Matriz de tipos de ingresso; ao menos um é obrigatório.
    function createEvent(
        address organizer,
        address paymentToken,
        uint256 platformFeeBps,
        uint256 maxTickets,
        string calldata eventName,
        uint256 eventTimestamp,
        uint96 royaltyBps,
        uint256 royaltyOrgShareBps,
        TicketTypeInput[] calldata types
    ) external onlyOwner returns (uint256 eventId) {
        require(organizer != address(0), "Invalid organizer");
        require(platformFeeBps < BPS, "Fee too high");
        require(eventTimestamp > 0, "Invalid event timestamp");
        require(royaltyBps <= 1000, "Royalty max 10%"); // sane cap
        require(royaltyOrgShareBps <= BPS, "Org share > 100%");
        require(types.length > 0, "Need at least one ticket type");

        // Deploy one RoyaltySplitter per event — um só, independentemente do número de tipos.
        RoyaltySplitter splitter = new RoyaltySplitter(organizer, platformWallet, royaltyOrgShareBps);

        eventId = _nextEventId++;
        events[eventId] = Event({
            organizer: organizer,
            paymentToken: paymentToken,
            platformFeeBps: platformFeeBps,
            maxTickets: maxTickets,
            soldTickets: 0,
            paused: false,
            eventName: eventName,
            eventTimestamp: eventTimestamp,
            royaltyBps: royaltyBps,
            royaltySplitter: address(splitter)
        });

        emit EventCreated(eventId, organizer, maxTickets, address(splitter));

        for (uint256 i = 0; i < types.length; i++) {
            _addTicketType(eventId, types[i]);
        }
    }

    /// Acrescenta um tipo depois da criação — abrir um lote novo, liberar uma área extra.
    function addTicketType(uint256 eventId, TicketTypeInput calldata t)
        external
        onlyOwner
        returns (uint256 typeId)
    {
        require(events[eventId].organizer != address(0), "Event does not exist");
        return _addTicketType(eventId, t);
    }

    function _addTicketType(uint256 eventId, TicketTypeInput calldata t) internal returns (uint256 typeId) {
        require(t.price > 0, "Price must be > 0");

        typeId = ticketTypeCount[eventId]++;
        ticketTypes[eventId][typeId] = TicketType({
            price: t.price,
            maxTickets: t.maxTickets,
            soldTickets: 0,
            salesEndAt: t.salesEndAt,
            paused: false,
            label: t.label
        });

        emit TicketTypeAdded(eventId, typeId, t.price, t.maxTickets, t.label);
    }

    function toggleEventPause(uint256 eventId) external onlyOwner {
        events[eventId].paused = !events[eventId].paused;
        emit EventPauseToggled(eventId, events[eventId].paused);
    }

    function toggleTicketTypePause(uint256 eventId, uint256 typeId) external onlyOwner {
        require(typeId < ticketTypeCount[eventId], "Invalid ticket type");
        TicketType storage t = ticketTypes[eventId][typeId];
        t.paused = !t.paused;
        emit TicketTypePauseToggled(eventId, typeId, t.paused);
    }

    function updatePlatformFee(uint256 eventId, uint256 newFeeBps) external onlyOwner {
        require(events[eventId].soldTickets == 0, "Sales already started");
        require(newFeeBps < BPS, "Fee too high");
        events[eventId].platformFeeBps = newFeeBps;
    }

    /// @notice Allows only increasing maxTickets or switching to unlimited (0).
    ///         Decreasing is not permitted to protect buyers who already purchased.
    function updateMaxTickets(uint256 eventId, uint256 newMax) external onlyOwner {
        Event storage ev = events[eventId];
        require(newMax == 0 || newMax > ev.maxTickets, "Can only increase max or set unlimited");
        ev.maxTickets = newMax;
        emit MaxTicketsUpdated(eventId, newMax);
    }

    /// Mesma regra do teto global, aplicada à cota do tipo: só aumenta ou zera.
    function updateTicketTypeMax(uint256 eventId, uint256 typeId, uint256 newMax) external onlyOwner {
        require(typeId < ticketTypeCount[eventId], "Invalid ticket type");
        TicketType storage t = ticketTypes[eventId][typeId];
        require(newMax == 0 || newMax > t.maxTickets, "Can only increase max or set unlimited");
        t.maxTickets = newMax;
        emit TicketTypeMaxUpdated(eventId, typeId, newMax);
    }

    /// Estender (ou remover, com 0) o prazo de um lote. Não permite encurtar: quem contava
    /// com o lote aberto até certa data não deve ser surpreendido — para fechar antes,
    /// use `toggleTicketTypePause`, que é explícito.
    function updateTicketTypeSalesEnd(uint256 eventId, uint256 typeId, uint256 newSalesEndAt)
        external
        onlyOwner
    {
        require(typeId < ticketTypeCount[eventId], "Invalid ticket type");
        TicketType storage t = ticketTypes[eventId][typeId];
        require(newSalesEndAt == 0 || newSalesEndAt > t.salesEndAt, "Can only extend or clear deadline");
        t.salesEndAt = newSalesEndAt;
        emit TicketTypeSalesEndUpdated(eventId, typeId, newSalesEndAt);
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    function getTicketType(uint256 eventId, uint256 typeId) external view returns (TicketType memory) {
        require(typeId < ticketTypeCount[eventId], "Invalid ticket type");
        return ticketTypes[eventId][typeId];
    }

    // ─── Buy ───────────────────────────────────────────────────────────────────

    /// Crypto-direct flow: caller pays and receives the NFT.
    function buyTicket(uint256 eventId, uint256 typeId)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256 tokenId)
    {
        return _buyTicket(eventId, typeId, msg.sender);
    }

    /// Fiat flow: caller (platform treasury) pays, NFT is minted to `recipient`.
    function buyTicketFor(uint256 eventId, uint256 typeId, address recipient)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256 tokenId)
    {
        require(recipient != address(0), "Invalid recipient");
        return _buyTicket(eventId, typeId, recipient);
    }

    function _buyTicket(uint256 eventId, uint256 typeId, address recipient) internal returns (uint256 tokenId) {
        Event storage ev = events[eventId];
        require(!ev.paused, "Event sales paused");
        require(typeId < ticketTypeCount[eventId], "Invalid ticket type");

        TicketType storage t = ticketTypes[eventId][typeId];
        require(!t.paused, "Ticket type sales paused");
        require(t.salesEndAt == 0 || block.timestamp < t.salesEndAt, "Ticket type sales ended");
        require(t.maxTickets == 0 || t.soldTickets < t.maxTickets, "Ticket type sold out");
        require(ev.maxTickets == 0 || ev.soldTickets < ev.maxTickets, "Sold out");
        require(block.timestamp < ev.eventTimestamp + SALE_GRACE_PERIOD, "Event has passed");

        // O número do ingresso continua sendo global do evento ("#N de M"), não por tipo —
        // é o que o metadata do NFT e a arte do colecionável já assumem.
        uint256 ticketNumber = ev.soldTickets + 1;
        ev.soldTickets = ticketNumber;
        t.soldTickets += 1;

        uint256 price = t.price;

        if (ev.paymentToken == address(0)) {
            require(msg.value == price, "Wrong ETH amount");
            _splitETH(ev.organizer, ev.platformFeeBps, price);
        } else {
            require(msg.value == 0, "ETH not accepted");
            IERC20(ev.paymentToken).safeTransferFrom(msg.sender, address(this), price);
            _splitERC20(ev.paymentToken, ev.organizer, ev.platformFeeBps, price);
        }

        tokenId = nft.mint(TicketNFT.MintParams({
            to: recipient,
            eventId: eventId,
            eventName: ev.eventName,
            ticketNumber: ticketNumber,
            totalTickets: ev.maxTickets,
            seat: t.label,
            eventTimestamp: ev.eventTimestamp,
            organizer: ev.organizer,
            // facePrice é o preço do *tipo*, não um preço único do evento — é o que
            // ancora o teto de revenda por ingresso (D26): quem comprou o Lote 1 barato
            // não revende no teto do Lote 3.
            facePrice: price,
            royaltyReceiver: ev.royaltySplitter,
            royaltyFeeBps: ev.royaltyBps
        }));

        emit TicketSold(eventId, recipient, tokenId, typeId, price);
    }

    // ─── Split helpers ─────────────────────────────────────────────────────────

    // Pull-payment: accumulate balances so a reverting organizer cannot grief the sale.
    function _splitETH(address organizer, uint256 platformFeeBps, uint256 total) internal {
        uint256 platformShare = (total * platformFeeBps) / BPS;
        uint256 organizerShare = total - platformShare;
        pendingWithdrawals[organizer] += organizerShare;
        if (platformShare > 0) {
            pendingWithdrawals[platformWallet] += platformShare;
        }
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingWithdrawals[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Withdraw failed");
        emit Withdrawn(msg.sender, amount);
    }

    function _splitERC20(address token, address organizer, uint256 platformFeeBps, uint256 total) internal {
        uint256 platformShare = (total * platformFeeBps) / BPS;
        uint256 organizerShare = total - platformShare;

        IERC20(token).safeTransfer(organizer, organizerShare);
        if (platformShare > 0) {
            IERC20(token).safeTransfer(platformWallet, platformShare);
        }
    }
}
