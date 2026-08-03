// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./TicketNFT.sol";

contract TicketResale is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    TicketNFT public immutable nft;
    address public platformWallet;
    uint256 public platformFeeBps;

    // Address allowed to call lockListing / unlockListing / settleListedTicket.
    // Set via setSettler after deploy; address(0) disables all settler-gated functions.
    address public settler;

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 price;
        address paymentToken; // address(0) = ETH
        uint256 expiresAt;    // 0 = no expiry
        bool active;
        bool locked;          // true while a PSP checkout is in progress
        address lockedBuyer;  // set at lock time; settle only delivers to this address
    }

    uint256 private _nextListingId;
    mapping(uint256 => Listing) public listings;

    uint256 private constant BPS = 10_000;

    event TicketListed(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 price);
    event TicketResold(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 sellerAmount,
        uint256 royaltyAmount,
        address royaltyReceiver,
        uint256 platformAmount
    );
    event ListingCancelled(uint256 indexed listingId);
    event ListingLocked(uint256 indexed listingId, address indexed buyer);
    event ListingUnlocked(uint256 indexed listingId);
    // Emitted by the off-chain-payment flow (Fluxo Reais e Fluxo Cripto, LAYOUT_UPDATE.md
    // §5.7): payment settled off-chain (PIX) or delivered via buyListedTicketFor, only the
    // NFT moves here — mas o split fica gravado nesta mesma transação como atestado
    // (§5.7.2): sellerAmount/royaltyAmount/platformAmount somam agreedPrice, e o royalty
    // vem de royaltyInfo(), não de um valor informado pelo caller. Isso é o que permite ao
    // organizador conferir o repasse sem depender de nenhum dado fornecido pela plataforma.
    event TicketSettled(
        uint256 indexed listingId,
        address indexed recipient,
        uint256 indexed tokenId,
        uint256 agreedPrice,
        uint256 sellerAmount,
        uint256 royaltyAmount,
        address royaltyReceiver,
        uint256 platformAmount
    );
    event PlatformFeeUpdated(uint256 newFeeBps);
    event PlatformWalletUpdated(address newWallet);
    event SettlerUpdated(address newSettler);

    constructor(address _nft, address _platformWallet, uint256 _platformFeeBps) Ownable(msg.sender) {
        require(_nft != address(0) && _platformWallet != address(0), "Invalid address");
        require(_platformFeeBps < BPS, "Fee too high");
        nft = TicketNFT(_nft);
        platformWallet = _platformWallet;
        platformFeeBps = _platformFeeBps;
    }

    modifier onlySettler() {
        require(msg.sender == settler, "Not settler");
        _;
    }

    // ─── Owner admin ───────────────────────────────────────────────────────────

    function setPlatformFee(uint256 _bps) external onlyOwner {
        require(_bps < BPS, "Fee too high");
        platformFeeBps = _bps;
        emit PlatformFeeUpdated(_bps);
    }

    function setPlatformWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "Invalid wallet");
        platformWallet = _wallet;
        emit PlatformWalletUpdated(_wallet);
    }

    function setSettler(address _settler) external onlyOwner {
        require(_settler != address(0), "Invalid settler");
        settler = _settler;
        emit SettlerUpdated(_settler);
    }

    // ─── List ──────────────────────────────────────────────────────────────────

    /// Transfers the NFT into escrow in this contract. Seller must have approved first.
    /// @param expiresAt unix timestamp; pass 0 for no expiry
    function listTicket(
        uint256 tokenId,
        uint256 price,
        address paymentToken,
        uint256 expiresAt
    ) external returns (uint256 listingId) {
        require(nft.ownerOf(tokenId) == msg.sender, "Not ticket owner");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Not approved"
        );
        require(price > 0, "Price must be > 0");
        require(expiresAt == 0 || expiresAt > block.timestamp, "Invalid expiry");

        // Escrow: NFT moves to this contract until sold or cancelled.
        nft.transferFrom(msg.sender, address(this), tokenId);

        listingId = _nextListingId++;
        listings[listingId] = Listing({
            seller:       msg.sender,
            tokenId:      tokenId,
            price:        price,
            paymentToken: paymentToken,
            expiresAt:    expiresAt,
            active:       true,
            locked:       false,
            lockedBuyer:  address(0)
        });

        emit TicketListed(listingId, msg.sender, tokenId, price);
    }

    /// Cancels the listing and returns the escrowed NFT to the seller.
    /// Reverts if the listing is locked (checkout in progress).
    function cancelListing(uint256 listingId) external {
        Listing storage l = listings[listingId];
        require(l.active, "Not active");
        require(!l.locked, "Listing locked");
        require(l.seller == msg.sender || owner() == msg.sender, "Not authorized");
        l.active = false;
        nft.transferFrom(address(this), l.seller, l.tokenId);
        emit ListingCancelled(listingId);
    }

    // ─── Lock (settler only) ───────────────────────────────────────────────────
    // Called by the backend immediately before creating the PSP charge.
    // Prevents the seller from cancelling while the buyer's payment is in flight.
    // Binding the buyer address at lock time means settleListedTicket can only
    // deliver to that exact address — a leaked settler key cannot redirect NFTs.

    function lockListing(uint256 listingId, address buyer) external onlySettler {
        require(buyer != address(0), "Invalid buyer");
        Listing storage l = listings[listingId];
        require(l.active && !l.locked, "Cannot lock");
        l.locked = true;
        l.lockedBuyer = buyer;
        emit ListingLocked(listingId, buyer);
    }

    /// Called by the backend when the PSP payment fails or times out.
    function unlockListing(uint256 listingId) external onlySettler {
        Listing storage l = listings[listingId];
        require(l.active && l.locked, "Not locked");
        l.locked = false;
        l.lockedBuyer = address(0);
        emit ListingUnlocked(listingId);
    }

    // ─── Buy ───────────────────────────────────────────────────────────────────

    /// Crypto-direct flow: caller pays on-chain and receives the NFT.
    function buyListedTicket(uint256 listingId) external payable nonReentrant {
        _buyListed(listingId, msg.sender);
    }

    /// Crypto-direct flow (treasury variant): caller pays, NFT goes to `recipient`.
    function buyListedTicketFor(uint256 listingId, address recipient) external payable nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        _buyListed(listingId, recipient);
    }

    /// Off-chain-payment resale flow (LAYOUT_UPDATE.md §5.7): payment was settled off-chain
    /// (PIX, no fluxo Reais) — this function transfers the escrowed NFT and, no mesmo passo,
    /// grava o split de `agreedPrice` como atestado on-chain (§5.7.2). `agreedPrice` é o
    /// preço do anúncio quando não há negociação, ou o valor acordado quando há (§6.4) —
    /// quem decide isso é o backend, o contrato só registra o que recebe.
    /// `recipient` must match the buyer recorded at lockListing — this prevents a compromised
    /// settler key from redirecting NFTs to an arbitrary address.
    function settleListedTicket(
        uint256 listingId,
        address recipient,
        uint256 agreedPrice
    ) external nonReentrant onlySettler {
        require(recipient != address(0), "Invalid recipient");
        require(agreedPrice > 0, "agreedPrice must be > 0");
        Listing storage l = listings[listingId];
        require(l.active, "Not active");
        require(l.locked, "Not locked");
        require(l.lockedBuyer == recipient, "Recipient mismatch");
        require(l.expiresAt == 0 || block.timestamp <= l.expiresAt, "Listing expired");

        l.active = false;
        l.locked = false;

        // Royalty calculado pelo contrato via ERC-2981 — nunca informado pelo caller.
        // É o que torna o atestado à prova de mentira sobre a fatia do organizador.
        (address royaltyReceiver, uint256 royaltyAmount) = nft.royaltyInfo(l.tokenId, agreedPrice);
        uint256 platformShare = (agreedPrice * platformFeeBps) / BPS;
        require(platformShare + royaltyAmount <= agreedPrice, "Fees exceed price");
        uint256 sellerShare = agreedPrice - platformShare - royaltyAmount;

        nft.transferFrom(address(this), recipient, l.tokenId);

        emit TicketSettled(listingId, recipient, l.tokenId, agreedPrice, sellerShare, royaltyAmount, royaltyReceiver, platformShare);
    }

    function _buyListed(uint256 listingId, address recipient) internal {
        Listing storage l = listings[listingId];
        require(l.active, "Not active");
        require(!l.locked, "Listing locked");
        require(l.expiresAt == 0 || block.timestamp <= l.expiresAt, "Listing expired");

        l.active = false;

        // Royalty enforced on-chain via ERC-2981 — seller cannot manipulate this
        (address royaltyReceiver, uint256 royaltyAmount) = nft.royaltyInfo(l.tokenId, l.price);

        uint256 platformShare = (l.price * platformFeeBps) / BPS;
        require(platformShare + royaltyAmount <= l.price, "Fees exceed price");
        uint256 sellerShare = l.price - platformShare - royaltyAmount;

        if (l.paymentToken == address(0)) {
            require(msg.value == l.price, "Wrong ETH amount");
            _payETH(l.seller, sellerShare);
            if (royaltyAmount > 0) _payETH(royaltyReceiver, royaltyAmount);
            _payETH(platformWallet, platformShare);
        } else {
            require(msg.value == 0, "ETH not accepted");
            IERC20(l.paymentToken).safeTransferFrom(msg.sender, l.seller, sellerShare);
            if (royaltyAmount > 0) {
                IERC20(l.paymentToken).safeTransferFrom(msg.sender, royaltyReceiver, royaltyAmount);
            }
            if (platformShare > 0) {
                IERC20(l.paymentToken).safeTransferFrom(msg.sender, platformWallet, platformShare);
            }
        }

        // NFT is held in escrow by this contract since listTicket
        nft.transferFrom(address(this), recipient, l.tokenId);

        emit TicketResold(listingId, recipient, l.tokenId, sellerShare, royaltyAmount, royaltyReceiver, platformShare);
    }

    // ─── Internal ──────────────────────────────────────────────────────────────

    function _payETH(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "ETH transfer failed");
    }
}
