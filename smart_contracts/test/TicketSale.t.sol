// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TicketNFT.sol";
import "../src/TicketSale.sol";
import "../src/RoyaltySplitter.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 10_000e18);
    }
}

contract TicketSaleTest is Test {
    TicketNFT public nft;
    TicketSale public sale;
    MockToken public usdc;

    address public owner = makeAddr("owner");
    address public platform = makeAddr("platform");
    address public organizer = makeAddr("organizer");
    address public buyer = makeAddr("buyer");

    uint256 public constant PRICE = 1 ether;
    uint256 public constant PLATFORM_FEE_BPS = 1000;  // 10%
    uint256 public constant MAX_TICKETS = 10;
    uint96  public constant ROYALTY_BPS = 500;         // 5% total royalty
    uint256 public constant ROYALTY_ORG_SHARE_BPS = 7000; // 70% to organizer, 30% to platform
    string  public constant BASE_URI = "https://api.platform.com/tickets/";

    uint256 public eventId;
    uint256 public constant TYPE_0 = 0;

    // ─── Helpers ───────────────────────────────────────────────────────────────

    /// Um tipo único, sem cota própria nem prazo — reproduz o evento de preço único.
    function _singleType(uint256 price, string memory label)
        internal
        pure
        returns (TicketSale.TicketTypeInput[] memory types)
    {
        types = new TicketSale.TicketTypeInput[](1);
        types[0] = TicketSale.TicketTypeInput({
            price: price,
            maxTickets: 0,
            salesEndAt: 0,
            label: label
        });
    }

    function setUp() public {
        vm.startPrank(owner);
        nft = new TicketNFT();
        sale = new TicketSale(address(nft), platform);
        nft.grantMinter(address(sale));
        nft.setBaseURI(BASE_URI);

        eventId = sale.createEvent(
            organizer,
            address(0), // ETH
            PLATFORM_FEE_BPS,
            MAX_TICKETS,
            "Rock Concert",
            block.timestamp + 30 days,
            ROYALTY_BPS,
            ROYALTY_ORG_SHARE_BPS,
            _singleType(PRICE, "General")
        );
        vm.stopPrank();

        vm.deal(buyer, 100 ether);
        usdc = new MockToken(); // minted to test contract (address(this))
    }

    // ─── Primary sale ──────────────────────────────────────────────────────────

    function test_BuyTicketETH() public {
        uint256 orgBefore = organizer.balance;
        uint256 platformBefore = platform.balance;

        vm.prank(buyer);
        uint256 tokenId = sale.buyTicket{value: PRICE}(eventId, TYPE_0);

        // ETH primary-sale proceeds use pull-payment: each party withdraws its share.
        vm.prank(organizer);
        sale.withdraw();
        vm.prank(platform);
        sale.withdraw();

        assertEq(nft.ownerOf(tokenId), buyer);
        assertEq(organizer.balance - orgBefore, 0.9 ether);
        assertEq(platform.balance - platformBefore, 0.1 ether);
    }

    function test_BuyTicket_SoldOut_Reverts() public {
        for (uint256 i = 0; i < MAX_TICKETS; i++) {
            address b = makeAddr(string(abi.encodePacked("buyer", i)));
            vm.deal(b, 2 ether);
            vm.prank(b);
            sale.buyTicket{value: PRICE}(eventId, TYPE_0);
        }

        vm.expectRevert("Sold out");
        vm.prank(buyer);
        sale.buyTicket{value: PRICE}(eventId, TYPE_0);
    }

    function test_BuyTicket_WrongETHAmount_Reverts() public {
        vm.prank(buyer);
        vm.expectRevert("Wrong ETH amount");
        sale.buyTicket{value: 0.5 ether}(eventId, TYPE_0);
    }

    function test_BuyTicket_PausedEvent_Reverts() public {
        vm.prank(owner);
        sale.toggleEventPause(eventId);

        vm.prank(buyer);
        vm.expectRevert("Event sales paused");
        sale.buyTicket{value: PRICE}(eventId, TYPE_0);
    }

    function test_TicketMetadata_StoredCorrectly() public {
        vm.prank(buyer);
        uint256 tokenId = sale.buyTicket{value: PRICE}(eventId, TYPE_0);

        (uint256 eId,, uint256 num, uint256 total, string memory seat,, address org, uint256 face) =
            nft.ticketData(tokenId);
        assertEq(eId, eventId);
        assertEq(num, 1);
        assertEq(total, MAX_TICKETS);
        assertEq(seat, "General");
        assertEq(org, organizer);
        assertEq(face, PRICE);
    }

    function test_TokenURI_UsesGlobalBaseURI() public {
        vm.prank(buyer);
        uint256 tokenId = sale.buyTicket{value: PRICE}(eventId, TYPE_0);

        // tokenId = 0 (first ever mint) → URI = BASE_URI + "0"
        assertEq(nft.tokenURI(tokenId), string.concat(BASE_URI, "0"));
    }

    function test_TicketNumberIncrements() public {
        vm.prank(buyer);
        uint256 t1 = sale.buyTicket{value: PRICE}(eventId, TYPE_0);

        address buyer2 = makeAddr("buyer2");
        vm.deal(buyer2, 2 ether);
        vm.prank(buyer2);
        uint256 t2 = sale.buyTicket{value: PRICE}(eventId, TYPE_0);

        (,, uint256 num1,,,,,) = nft.ticketData(t1);
        (,, uint256 num2,,,,,) = nft.ticketData(t2);
        assertEq(num1, 1);
        assertEq(num2, 2);
    }

    function test_BuyTicketERC20() public {
        usdc.transfer(buyer, 100e18);
        vm.startPrank(owner);
        uint256 usdcEventId = sale.createEvent(
            organizer,
            address(usdc),
            PLATFORM_FEE_BPS,
            10,
            "USDC Concert",
            block.timestamp + 30 days,
            ROYALTY_BPS,
            ROYALTY_ORG_SHARE_BPS,
            _singleType(100e18, "General")
        );
        vm.stopPrank();

        vm.startPrank(buyer);
        usdc.approve(address(sale), 100e18);
        sale.buyTicket(usdcEventId, TYPE_0);
        vm.stopPrank();

        assertEq(usdc.balanceOf(organizer), 90e18);
        assertEq(usdc.balanceOf(platform), 10e18);
    }

    // ─── buyTicketFor (fiat flow: treasury pays, recipient receives) ────────────

    function test_BuyTicketFor_MintsToRecipient() public {
        address treasury = makeAddr("treasury");
        address recipient = makeAddr("recipient");
        vm.deal(treasury, 10 ether);

        uint256 orgBefore = organizer.balance;
        uint256 platformBefore = platform.balance;

        vm.prank(treasury);
        uint256 tid = sale.buyTicketFor{value: PRICE}(eventId, TYPE_0, recipient);

        // ETH proceeds are escrowed (pull-payment) regardless of who paid.
        vm.prank(organizer);
        sale.withdraw();
        vm.prank(platform);
        sale.withdraw();

        assertEq(nft.ownerOf(tid), recipient);
        assertEq(organizer.balance - orgBefore, 0.9 ether);
        assertEq(platform.balance - platformBefore, 0.1 ether);
    }

    function test_BuyTicketFor_ERC20_PaidByCaller() public {
        address treasury = makeAddr("treasury");
        address recipient = makeAddr("recipient");
        usdc.transfer(treasury, 100e18);

        vm.startPrank(owner);
        uint256 usdcEventId = sale.createEvent(
            organizer,
            address(usdc),
            PLATFORM_FEE_BPS,
            10,
            "USDC Concert",
            block.timestamp + 30 days,
            ROYALTY_BPS,
            ROYALTY_ORG_SHARE_BPS,
            _singleType(100e18, "General")
        );
        vm.stopPrank();

        vm.startPrank(treasury);
        usdc.approve(address(sale), 100e18);
        uint256 tid = sale.buyTicketFor(usdcEventId, TYPE_0, recipient);
        vm.stopPrank();

        assertEq(nft.ownerOf(tid), recipient);
        assertEq(usdc.balanceOf(treasury), 0);
        assertEq(usdc.balanceOf(organizer), 90e18);
        assertEq(usdc.balanceOf(platform), 10e18);
    }

    function test_BuyTicketFor_ZeroRecipient_Reverts() public {
        vm.prank(buyer);
        vm.expectRevert("Invalid recipient");
        sale.buyTicketFor{value: PRICE}(eventId, TYPE_0, address(0));
    }

    function test_UpdatePlatformFee_AfterSales_Reverts() public {
        vm.prank(buyer);
        sale.buyTicket{value: PRICE}(eventId, TYPE_0);

        vm.prank(owner);
        vm.expectRevert("Sales already started");
        sale.updatePlatformFee(eventId, 500);
    }

    // ─── TicketType — matriz área × dia × lote (D22/D23, A1 opção 5.2a) ────────

    /// Monta o evento de referência do §5.1: 2 dias × 2 áreas × 3 lotes = 12 tipos.
    function _createMatrixEvent() internal returns (uint256 evId) {
        TicketSale.TicketTypeInput[] memory types = new TicketSale.TicketTypeInput[](12);
        uint256 i = 0;
        for (uint256 day = 1; day <= 2; day++) {
            for (uint256 area = 0; area < 2; area++) {
                for (uint256 lot = 1; lot <= 3; lot++) {
                    types[i] = TicketSale.TicketTypeInput({
                        price: lot * 1 ether, // lote 1 = 1 ETH, lote 3 = 3 ETH
                        maxTickets: 100,
                        salesEndAt: 0,
                        label: string.concat(
                            area == 0 ? "Pista" : "Camarote",
                            " - Dia ", vm.toString(day),
                            " - Lote ", vm.toString(lot)
                        )
                    });
                    i++;
                }
            }
        }

        vm.prank(owner);
        evId = sale.createEvent(
            organizer, address(0), PLATFORM_FEE_BPS, 5000,
            "Festival", block.timestamp + 90 days,
            ROYALTY_BPS, ROYALTY_ORG_SHARE_BPS, types
        );
    }

    function test_CreateEvent_WithMatrix_RegistersAllTypes() public {
        uint256 evId = _createMatrixEvent();
        assertEq(sale.ticketTypeCount(evId), 12);

        TicketSale.TicketType memory first = sale.getTicketType(evId, 0);
        TicketSale.TicketType memory last  = sale.getTicketType(evId, 11);
        assertEq(first.price, 1 ether);
        assertEq(first.label, "Pista - Dia 1 - Lote 1");
        assertEq(last.price, 3 ether);
        assertEq(last.label, "Camarote - Dia 2 - Lote 3");
    }

    /// O ponto do D26: cada tipo grava o *seu* preço como facePrice do NFT, então o teto
    /// de revenda de quem comprou o Lote 1 não acompanha o preço do Lote 3.
    function test_FacePrice_IsPerType_NotPerEvent() public {
        uint256 evId = _createMatrixEvent();

        vm.deal(buyer, 100 ether);
        vm.startPrank(buyer);
        uint256 cheapToken = sale.buyTicket{value: 1 ether}(evId, 0);  // Lote 1
        uint256 pricyToken = sale.buyTicket{value: 3 ether}(evId, 2);  // Lote 3
        vm.stopPrank();

        (,,,,,,, uint256 cheapFace) = nft.ticketData(cheapToken);
        (,,,,,,, uint256 pricyFace) = nft.ticketData(pricyToken);
        assertEq(cheapFace, 1 ether);
        assertEq(pricyFace, 3 ether);
    }

    /// O argumento decisivo contra a opção 5.2b: 12 tipos, um único RoyaltySplitter.
    function test_MatrixEvent_HasSingleRoyaltySplitter() public {
        uint256 evId = _createMatrixEvent();
        (,,,,,,,,, address splitterAddr) = sale.events(evId);
        assertTrue(splitterAddr != address(0));

        vm.deal(buyer, 100 ether);
        vm.startPrank(buyer);
        uint256 t1 = sale.buyTicket{value: 1 ether}(evId, 0);
        uint256 t2 = sale.buyTicket{value: 2 ether}(evId, 7);
        vm.stopPrank();

        // Todo royalty do evento, de qualquer tipo, cai no mesmo endereço de saque.
        (address r1,) = nft.royaltyInfo(t1, 1 ether);
        (address r2,) = nft.royaltyInfo(t2, 1 ether);
        assertEq(r1, splitterAddr);
        assertEq(r2, splitterAddr);
    }

    function test_TypeSeat_WritesTicketLabel() public {
        uint256 evId = _createMatrixEvent();
        vm.prank(buyer);
        uint256 tid = sale.buyTicket{value: 2 ether}(evId, 4); // Camarote - Dia 1 - Lote 2

        (,,,, string memory seat,,,) = nft.ticketData(tid);
        assertEq(seat, "Camarote - Dia 1 - Lote 2");
    }

    function test_BuyTicket_InvalidType_Reverts() public {
        vm.prank(buyer);
        vm.expectRevert("Invalid ticket type");
        sale.buyTicket{value: PRICE}(eventId, 99);
    }

    function test_TypeQuota_SoldOut_DoesNotBlockOtherTypes() public {
        TicketSale.TicketTypeInput[] memory types = new TicketSale.TicketTypeInput[](2);
        types[0] = TicketSale.TicketTypeInput({price: 1 ether, maxTickets: 1, salesEndAt: 0, label: "Pista"});
        types[1] = TicketSale.TicketTypeInput({price: 2 ether, maxTickets: 5, salesEndAt: 0, label: "Camarote"});

        vm.prank(owner);
        uint256 evId = sale.createEvent(
            organizer, address(0), PLATFORM_FEE_BPS, 0,
            "Two Areas", block.timestamp + 30 days,
            ROYALTY_BPS, ROYALTY_ORG_SHARE_BPS, types
        );

        vm.deal(buyer, 100 ether);
        vm.prank(buyer);
        sale.buyTicket{value: 1 ether}(evId, 0); // esgota a Pista

        vm.prank(buyer);
        vm.expectRevert("Ticket type sold out");
        sale.buyTicket{value: 1 ether}(evId, 0);

        // Camarote continua vendendo.
        vm.prank(buyer);
        uint256 tid = sale.buyTicket{value: 2 ether}(evId, 1);
        assertEq(nft.ownerOf(tid), buyer);
    }

    /// O teto global do evento manda mesmo quando a soma das cotas dos tipos é maior —
    /// que é justamente o caso dos lotes sequenciais da mesma área.
    function test_EventCap_BindsAcrossTypes() public {
        TicketSale.TicketTypeInput[] memory types = new TicketSale.TicketTypeInput[](2);
        types[0] = TicketSale.TicketTypeInput({price: 1 ether, maxTickets: 10, salesEndAt: 0, label: "Lote 1"});
        types[1] = TicketSale.TicketTypeInput({price: 2 ether, maxTickets: 10, salesEndAt: 0, label: "Lote 2"});

        vm.prank(owner);
        uint256 evId = sale.createEvent(
            organizer, address(0), PLATFORM_FEE_BPS, 3, // teto global = 3, cotas somam 20
            "Capped", block.timestamp + 30 days,
            ROYALTY_BPS, ROYALTY_ORG_SHARE_BPS, types
        );

        vm.deal(buyer, 100 ether);
        vm.startPrank(buyer);
        sale.buyTicket{value: 1 ether}(evId, 0);
        sale.buyTicket{value: 1 ether}(evId, 0);
        sale.buyTicket{value: 2 ether}(evId, 1);

        vm.expectRevert("Sold out");
        sale.buyTicket{value: 2 ether}(evId, 1);
        vm.stopPrank();
    }

    function test_TypePause_BlocksOnlyThatType() public {
        uint256 evId = _createMatrixEvent();

        vm.prank(owner);
        sale.toggleTicketTypePause(evId, 0);

        vm.deal(buyer, 100 ether);
        vm.prank(buyer);
        vm.expectRevert("Ticket type sales paused");
        sale.buyTicket{value: 1 ether}(evId, 0);

        vm.prank(buyer);
        uint256 tid = sale.buyTicket{value: 2 ether}(evId, 1);
        assertEq(nft.ownerOf(tid), buyer);
    }

    function test_TypeSalesEnd_ClosesLot() public {
        TicketSale.TicketTypeInput[] memory types = new TicketSale.TicketTypeInput[](2);
        types[0] = TicketSale.TicketTypeInput({
            price: 1 ether, maxTickets: 0, salesEndAt: block.timestamp + 7 days, label: "Lote 1"
        });
        types[1] = TicketSale.TicketTypeInput({price: 2 ether, maxTickets: 0, salesEndAt: 0, label: "Lote 2"});

        vm.prank(owner);
        uint256 evId = sale.createEvent(
            organizer, address(0), PLATFORM_FEE_BPS, 0,
            "Lots", block.timestamp + 60 days,
            ROYALTY_BPS, ROYALTY_ORG_SHARE_BPS, types
        );

        vm.deal(buyer, 100 ether);
        vm.warp(block.timestamp + 8 days);

        vm.prank(buyer);
        vm.expectRevert("Ticket type sales ended");
        sale.buyTicket{value: 1 ether}(evId, 0);

        vm.prank(buyer);
        sale.buyTicket{value: 2 ether}(evId, 1); // Lote 2 segue aberto
    }

    function test_AddTicketType_AfterCreation() public {
        vm.prank(owner);
        uint256 typeId = sale.addTicketType(
            eventId,
            TicketSale.TicketTypeInput({price: 5 ether, maxTickets: 3, salesEndAt: 0, label: "VIP"})
        );
        assertEq(typeId, 1);
        assertEq(sale.ticketTypeCount(eventId), 2);

        vm.prank(buyer);
        uint256 tid = sale.buyTicket{value: 5 ether}(eventId, typeId);
        (,,,, string memory seat,,, uint256 face) = nft.ticketData(tid);
        assertEq(seat, "VIP");
        assertEq(face, 5 ether);
    }

    function test_CreateEvent_NoTypes_Reverts() public {
        TicketSale.TicketTypeInput[] memory empty = new TicketSale.TicketTypeInput[](0);
        vm.prank(owner);
        vm.expectRevert("Need at least one ticket type");
        sale.createEvent(
            organizer, address(0), PLATFORM_FEE_BPS, 10,
            "No Types", block.timestamp + 30 days,
            ROYALTY_BPS, ROYALTY_ORG_SHARE_BPS, empty
        );
    }

    function test_CreateEvent_ZeroPriceType_Reverts() public {
        vm.prank(owner);
        vm.expectRevert("Price must be > 0");
        sale.createEvent(
            organizer, address(0), PLATFORM_FEE_BPS, 10,
            "Free", block.timestamp + 30 days,
            ROYALTY_BPS, ROYALTY_ORG_SHARE_BPS, _singleType(0, "General")
        );
    }

    function test_UpdateTicketTypeMax_OnlyIncreases() public {
        vm.startPrank(owner);
        uint256 typeId = sale.addTicketType(
            eventId,
            TicketSale.TicketTypeInput({price: 5 ether, maxTickets: 3, salesEndAt: 0, label: "VIP"})
        );

        sale.updateTicketTypeMax(eventId, typeId, 10);
        assertEq(sale.getTicketType(eventId, typeId).maxTickets, 10);

        vm.expectRevert("Can only increase max or set unlimited");
        sale.updateTicketTypeMax(eventId, typeId, 5);
        vm.stopPrank();
    }

    function test_UpdateTicketTypeSalesEnd_OnlyExtends() public {
        uint256 deadline = block.timestamp + 7 days;
        TicketSale.TicketTypeInput[] memory types = new TicketSale.TicketTypeInput[](1);
        types[0] = TicketSale.TicketTypeInput({price: 1 ether, maxTickets: 0, salesEndAt: deadline, label: "Lote 1"});

        vm.startPrank(owner);
        uint256 evId = sale.createEvent(
            organizer, address(0), PLATFORM_FEE_BPS, 0,
            "Lots", block.timestamp + 60 days,
            ROYALTY_BPS, ROYALTY_ORG_SHARE_BPS, types
        );

        sale.updateTicketTypeSalesEnd(evId, 0, deadline + 3 days);
        assertEq(sale.getTicketType(evId, 0).salesEndAt, deadline + 3 days);

        vm.expectRevert("Can only extend or clear deadline");
        sale.updateTicketTypeSalesEnd(evId, 0, deadline);
        vm.stopPrank();
    }

    // ─── RoyaltySplitter ───────────────────────────────────────────────────────

    function test_RoyaltySplitter_DeployedPerEvent() public view {
        (,,,,,,,,, address splitterAddr) = sale.events(eventId);
        assertTrue(splitterAddr != address(0));
    }

    function test_RoyaltySplitter_SetAsRoyaltyReceiver() public {
        vm.prank(buyer);
        uint256 tokenId = sale.buyTicket{value: PRICE}(eventId, TYPE_0);

        (,,,,,,,,, address splitterAddr) = sale.events(eventId);
        (address receiver,) = nft.royaltyInfo(tokenId, 1 ether);
        assertEq(receiver, splitterAddr);
    }

    function test_RoyaltySplitter_RoyaltyBps() public {
        vm.prank(buyer);
        uint256 tokenId = sale.buyTicket{value: PRICE}(eventId, TYPE_0);

        // 5% royalty on a 10 ETH sale = 0.5 ETH
        (, uint256 royaltyAmount) = nft.royaltyInfo(tokenId, 10 ether);
        assertEq(royaltyAmount, 0.5 ether);
    }

    function test_RoyaltySplitter_SplitsETH() public {
        vm.prank(buyer);
        sale.buyTicket{value: PRICE}(eventId, TYPE_0);

        (,,,,,,,,, address splitterAddr) = sale.events(eventId);
        RoyaltySplitter splitter = RoyaltySplitter(payable(splitterAddr));

        uint256 orgBefore = organizer.balance;
        uint256 platformBefore = platform.balance;

        // Simulate a marketplace sending 1 ETH royalty to the splitter
        vm.deal(address(this), 1 ether);
        (bool ok,) = splitterAddr.call{value: 1 ether}("");
        assertTrue(ok);

        // RoyaltySplitter uses pull-payment: each party withdraws its credited share.
        vm.prank(organizer);
        splitter.withdraw();
        vm.prank(platform);
        splitter.withdraw();

        // 70% to organizer, 30% to platform
        assertEq(organizer.balance - orgBefore, 0.7 ether);
        assertEq(platform.balance - platformBefore, 0.3 ether);

        assertEq(splitter.organizer(), organizer);
        assertEq(splitter.platform(), platform);
        assertEq(splitter.organizerShareBps(), ROYALTY_ORG_SHARE_BPS);
    }

    function test_RoyaltySplitter_SplitsERC20() public {
        vm.prank(buyer);
        sale.buyTicket{value: PRICE}(eventId, TYPE_0);

        (,,,,,,,,, address splitterAddr) = sale.events(eventId);

        // Send 100 USDC to splitter (simulating marketplace ERC-20 royalty payment)
        usdc.transfer(splitterAddr, 100e18);

        uint256 orgBefore = usdc.balanceOf(organizer);
        uint256 platformBefore = usdc.balanceOf(platform);

        RoyaltySplitter splitter = RoyaltySplitter(payable(splitterAddr));
        splitter.releaseERC20(address(usdc));

        // ERC-20 royalties are also pull-payment: each party withdraws its share.
        vm.prank(organizer);
        splitter.withdrawERC20(address(usdc));
        vm.prank(platform);
        splitter.withdrawERC20(address(usdc));

        assertEq(usdc.balanceOf(organizer) - orgBefore, 70e18);   // 70%
        assertEq(usdc.balanceOf(platform) - platformBefore, 30e18); // 30%
    }

    function test_TwoEvents_HaveDifferentSplitters() public {
        vm.prank(owner);
        uint256 eventId2 = sale.createEvent(
            organizer, address(0), PLATFORM_FEE_BPS, 5,
            "Second Show", block.timestamp + 60 days,
            ROYALTY_BPS, ROYALTY_ORG_SHARE_BPS, _singleType(PRICE, "VIP")
        );

        (,,,,,,,,, address splitter1) = sale.events(eventId);
        (,,,,,,,,, address splitter2) = sale.events(eventId2);
        assertTrue(splitter1 != splitter2);
    }

    // ─── Benchmark A1: opção (a) vs opção (b) ──────────────────────────────────
    // PLANO_EVOLUCAO_V2.md §7 A1 pede a decisão "com custo de gas na mesa".
    // Cenário: o evento de referência do §5.1 — 2 dias × 2 áreas × 3 lotes = 12 tipos.

    function test_Benchmark_MatrixEvent_OptionA_vs_OptionB() public {
        // (a) um createEvent com os 12 tipos → 1 RoyaltySplitter
        uint256 gasBefore = gasleft();
        _createMatrixEvent();
        uint256 gasOptionA = gasBefore - gasleft();

        // (b) 12 createEvent de tipo único → 12 RoyaltySplitter
        gasBefore = gasleft();
        for (uint256 i = 0; i < 12; i++) {
            vm.prank(owner);
            sale.createEvent(
                organizer, address(0), PLATFORM_FEE_BPS, 100,
                "Festival", block.timestamp + 90 days,
                ROYALTY_BPS, ROYALTY_ORG_SHARE_BPS,
                _singleType((i % 3 + 1) * 1 ether, "Pista - Dia 1 - Lote 1")
            );
        }
        uint256 gasOptionB = gasBefore - gasleft();

        console.log("A1 - criacao de evento 2 dias x 2 areas x 3 lotes (12 tipos)");
        console.log("  (a) TicketType on-chain, 1 splitter :", gasOptionA);
        console.log("  (b) 12 eventos on-chain, 12 splitters:", gasOptionB);
        console.log("  economia de (a) sobre (b)           :", gasOptionB - gasOptionA);
        console.log("  razao b/a (x100)                    :", (gasOptionB * 100) / gasOptionA);

        assertLt(gasOptionA, gasOptionB, "opcao (a) deve custar menos gas que (b)");
    }

    /// A compra em si não deve regredir: (a) acrescenta a leitura do tipo, e nada mais.
    function test_Benchmark_BuyTicket() public {
        vm.prank(buyer);
        uint256 gasBefore = gasleft();
        sale.buyTicket{value: PRICE}(eventId, TYPE_0);
        console.log("A1 - buyTicket (1 tipo, mint incluso):", gasBefore - gasleft());
    }
}
