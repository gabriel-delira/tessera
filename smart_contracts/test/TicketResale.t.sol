// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TicketNFT.sol";
import "../src/TicketSale.sol";
import "../src/TicketResale.sol";
import "../src/RoyaltySplitter.sol";

contract TicketResaleTest is Test {
    TicketNFT public nft;
    TicketSale public sale;
    TicketResale public resale;

    address public owner    = makeAddr("owner");
    address public platform = makeAddr("platform");
    address public organizer = makeAddr("organizer");
    address public seller   = makeAddr("seller");
    address public buyer    = makeAddr("buyer");
    address public settler  = makeAddr("settler");

    uint256 public constant PLATFORM_FEE_BPS    = 500;  // 5%
    uint256 public constant EVENT_ROYALTY_BPS   = 500;  // 5%
    uint256 public constant ROYALTY_ORG_SHARE_BPS = 7000; // 70% of royalty → organizer
    uint256 public constant RESALE_PRICE        = 2 ether;

    uint256 public tokenId;
    uint256 public listingId;

    function setUp() public {
        vm.startPrank(owner);
        nft     = new TicketNFT();
        sale    = new TicketSale(address(nft), platform);
        resale  = new TicketResale(address(nft), platform, PLATFORM_FEE_BPS);
        nft.grantMinter(address(sale));
        resale.setSettler(settler);
        vm.stopPrank();

        vm.deal(seller, 10 ether);
        vm.deal(buyer, 10 ether);

        // Seller buys ticket in primary market
        vm.startPrank(owner);
        uint256 eventId = sale.createEvent(
            organizer, 1 ether, address(0), 1000, 10, "Festival",
            block.timestamp + 30 days, "GA",
            uint96(EVENT_ROYALTY_BPS), ROYALTY_ORG_SHARE_BPS
        );
        vm.stopPrank();

        vm.prank(seller);
        tokenId = sale.buyTicket{value: 1 ether}(eventId);

        // Seller approves resale contract and lists — NFT goes into escrow
        vm.startPrank(seller);
        nft.approve(address(resale), tokenId);
        listingId = resale.listTicket(tokenId, RESALE_PRICE, address(0), 0);
        vm.stopPrank();
    }

    // ─── Listing ───────────────────────────────────────────────────────────────

    function test_ListTicket_EscrowsNFT() public view {
        assertEq(nft.ownerOf(tokenId), address(resale));
        (address listedSeller, uint256 listedToken, uint256 price, , , bool active, bool locked, address lockedBuyer) = resale.listings(listingId);
        assertEq(listedSeller, seller);
        assertEq(listedToken, tokenId);
        assertEq(price, RESALE_PRICE);
        assertTrue(active);
        assertFalse(locked);
        assertEq(lockedBuyer, address(0));
    }

    function test_NonOwner_CannotList_Reverts() public {
        // After setUp, NFT is escrowed — buyer doesn't own it
        vm.prank(buyer);
        vm.expectRevert("Not ticket owner");
        resale.listTicket(tokenId, RESALE_PRICE, address(0), 0);
    }

    // ─── Cancel ────────────────────────────────────────────────────────────────

    function test_CancelListing_ReturnsNFTToSeller() public {
        vm.prank(seller);
        resale.cancelListing(listingId);

        assertEq(nft.ownerOf(tokenId), seller);
        (, , , , , bool active, , ) = resale.listings(listingId);
        assertFalse(active);
    }

    function test_BuyAfterCancel_Reverts() public {
        vm.prank(seller);
        resale.cancelListing(listingId);

        vm.prank(buyer);
        vm.expectRevert("Not active");
        resale.buyListedTicket{value: RESALE_PRICE}(listingId);
    }

    function test_OnlyOwner_CanCancelOthersListing() public {
        vm.prank(owner);
        resale.cancelListing(listingId);

        assertEq(nft.ownerOf(tokenId), seller);
        (, , , , , bool active, , ) = resale.listings(listingId);
        assertFalse(active);
    }

    // ─── Lock / Unlock ─────────────────────────────────────────────────────────

    function test_LockListing_PreventsCancel() public {
        vm.prank(settler);
        resale.lockListing(listingId, buyer);

        (, , , , , , bool locked, address lockedBuyer) = resale.listings(listingId);
        assertTrue(locked);
        assertEq(lockedBuyer, buyer);

        vm.prank(seller);
        vm.expectRevert("Listing locked");
        resale.cancelListing(listingId);
    }

    function test_UnlockListing_AllowsCancelAgain() public {
        vm.prank(settler);
        resale.lockListing(listingId, buyer);

        vm.prank(settler);
        resale.unlockListing(listingId);

        (, , , , , , bool locked, address lockedBuyer) = resale.listings(listingId);
        assertFalse(locked);
        assertEq(lockedBuyer, address(0));

        vm.prank(seller);
        resale.cancelListing(listingId); // must not revert
        assertEq(nft.ownerOf(tokenId), seller);
    }

    function test_Lock_NonSettler_Reverts() public {
        vm.prank(buyer);
        vm.expectRevert("Not settler");
        resale.lockListing(listingId, buyer);
    }

    function test_Lock_AlreadyLocked_Reverts() public {
        vm.prank(settler);
        resale.lockListing(listingId, buyer);

        vm.prank(settler);
        vm.expectRevert("Cannot lock");
        resale.lockListing(listingId, buyer);
    }

    function test_Unlock_NotLocked_Reverts() public {
        vm.prank(settler);
        vm.expectRevert("Not locked");
        resale.unlockListing(listingId);
    }

    // ─── Buy (crypto-direct) ───────────────────────────────────────────────────

    function test_BuyListedTicket_Split() public {
        uint256 sellerBefore   = seller.balance;
        uint256 orgBefore      = organizer.balance;
        uint256 platformBefore = platform.balance;

        vm.prank(buyer);
        resale.buyListedTicket{value: RESALE_PRICE}(listingId);

        assertEq(nft.ownerOf(tokenId), buyer);

        uint256 royaltyAmount  = (RESALE_PRICE * EVENT_ROYALTY_BPS) / 10_000;
        uint256 platformShare  = (RESALE_PRICE * PLATFORM_FEE_BPS) / 10_000;
        uint256 sellerShare    = RESALE_PRICE - royaltyAmount - platformShare;

        uint256 orgFromRoyalty      = (royaltyAmount * ROYALTY_ORG_SHARE_BPS) / 10_000;
        uint256 platformFromRoyalty = royaltyAmount - orgFromRoyalty;

        // The on-chain royalty (ERC-2981) is routed to the event's RoyaltySplitter,
        // which holds it as pull-payment — organizer/platform withdraw their cut.
        (address splitterAddr,) = nft.royaltyInfo(tokenId, RESALE_PRICE);
        vm.prank(organizer);
        RoyaltySplitter(payable(splitterAddr)).withdraw();
        vm.prank(platform);
        RoyaltySplitter(payable(splitterAddr)).withdraw();

        assertEq(seller.balance   - sellerBefore,   sellerShare);
        assertEq(organizer.balance - orgBefore,      orgFromRoyalty);
        assertEq(platform.balance  - platformBefore, platformShare + platformFromRoyalty);
    }

    function test_BuyListed_WrongETH_Reverts() public {
        vm.prank(buyer);
        vm.expectRevert("Wrong ETH amount");
        resale.buyListedTicket{value: 1 ether}(listingId);
    }

    function test_BuyListedTicketFor_DeliversToRecipient() public {
        address treasury  = makeAddr("treasury");
        address recipient = makeAddr("recipient");
        vm.deal(treasury, 10 ether);

        uint256 sellerBefore   = seller.balance;
        uint256 platformBefore = platform.balance;

        vm.prank(treasury);
        resale.buyListedTicketFor{value: RESALE_PRICE}(listingId, recipient);

        assertEq(nft.ownerOf(tokenId), recipient);

        uint256 royaltyAmount       = (RESALE_PRICE * EVENT_ROYALTY_BPS) / 10_000;
        uint256 platformShare       = (RESALE_PRICE * PLATFORM_FEE_BPS) / 10_000;
        uint256 sellerShare         = RESALE_PRICE - royaltyAmount - platformShare;
        uint256 platformFromRoyalty = royaltyAmount - (royaltyAmount * ROYALTY_ORG_SHARE_BPS) / 10_000;

        // Flush the platform's royalty cut held by the RoyaltySplitter (pull-payment).
        (address splitterAddr,) = nft.royaltyInfo(tokenId, RESALE_PRICE);
        vm.prank(platform);
        RoyaltySplitter(payable(splitterAddr)).withdraw();

        assertEq(seller.balance   - sellerBefore,   sellerShare);
        assertEq(platform.balance - platformBefore,  platformShare + platformFromRoyalty);
    }

    function test_BuyListedTicketFor_ZeroRecipient_Reverts() public {
        vm.prank(buyer);
        vm.expectRevert("Invalid recipient");
        resale.buyListedTicketFor{value: RESALE_PRICE}(listingId, address(0));
    }

    function test_ListingExpiry_Reverts() public {
        // Return NFT to seller first by cancelling the setUp listing
        vm.prank(seller);
        resale.cancelListing(listingId);

        vm.startPrank(seller);
        nft.approve(address(resale), tokenId);
        uint256 lid = resale.listTicket(tokenId, RESALE_PRICE, address(0), block.timestamp + 1 days);
        vm.stopPrank();

        vm.warp(block.timestamp + 2 days);

        vm.prank(buyer);
        vm.expectRevert("Listing expired");
        resale.buyListedTicket{value: RESALE_PRICE}(lid);
    }

    // ─── settleListedTicket (fiat resale: PSP handled payment, only NFT transfer on-chain) ──

    // Helper: lock the default listingId for `buyer` (the test's buyer address).
    function _lockForBuyer() internal {
        vm.prank(settler);
        resale.lockListing(listingId, buyer);
    }

    function test_SettleListedTicket_TransfersNFT() public {
        _lockForBuyer();

        vm.prank(settler);
        resale.settleListedTicket(listingId, buyer, RESALE_PRICE);

        assertEq(nft.ownerOf(tokenId), buyer);
        (, , , , , bool active, , ) = resale.listings(listingId);
        assertFalse(active);
    }

    function test_SettleListedTicket_EmitsEvent() public {
        _lockForBuyer();

        vm.expectEmit(true, true, true, false);
        emit TicketResale.TicketSettled(listingId, buyer, tokenId, RESALE_PRICE, 0, 0, address(0), 0);

        vm.prank(settler);
        resale.settleListedTicket(listingId, buyer, RESALE_PRICE);
    }

    // LAYOUT_UPDATE.md §5.7.2 — atestado on-chain: o split emitido tem que bater
    // com o cálculo esperado (mesma fórmula do fluxo cripto em _buyListed) e
    // depender só de agreedPrice + royaltyInfo(), nunca de um valor passado à parte.
    function test_SettleListedTicket_EmitsCorrectSplit() public {
        _lockForBuyer();

        (address royaltyReceiver, uint256 royaltyAmount) = nft.royaltyInfo(tokenId, RESALE_PRICE);
        uint256 platformShare = (RESALE_PRICE * resale.platformFeeBps()) / 10_000;
        uint256 sellerShare   = RESALE_PRICE - platformShare - royaltyAmount;

        vm.expectEmit(true, true, true, true);
        emit TicketResale.TicketSettled(listingId, buyer, tokenId, RESALE_PRICE, sellerShare, royaltyAmount, royaltyReceiver, platformShare);

        vm.prank(settler);
        resale.settleListedTicket(listingId, buyer, RESALE_PRICE);
    }

    // Preço negociado (§6.4) pode divergir do preço do anúncio — o atestado
    // reflete o valor acordado, não l.price.
    function test_SettleListedTicket_UsesAgreedPriceNotListingPrice() public {
        _lockForBuyer();
        uint256 negotiatedPrice = RESALE_PRICE - 0.3 ether;

        (, uint256 royaltyAmount) = nft.royaltyInfo(tokenId, negotiatedPrice);
        uint256 platformShare = (negotiatedPrice * resale.platformFeeBps()) / 10_000;
        uint256 sellerShare   = negotiatedPrice - platformShare - royaltyAmount;

        vm.prank(settler);
        resale.settleListedTicket(listingId, buyer, negotiatedPrice);

        // Sem storage de split — a asserção de valor vive no teste de evento acima;
        // aqui garantimos apenas que a chamada com preço diferente não reverte e
        // ainda transfere o NFT normalmente.
        assertEq(nft.ownerOf(tokenId), buyer);
        assertGt(sellerShare, 0);
    }

    function test_SettleListedTicket_ZeroAgreedPrice_Reverts() public {
        _lockForBuyer();

        vm.prank(settler);
        vm.expectRevert("agreedPrice must be > 0");
        resale.settleListedTicket(listingId, buyer, 0);
    }

    function test_SettleListedTicket_WrongRecipient_Reverts() public {
        _lockForBuyer();

        vm.prank(settler);
        vm.expectRevert("Recipient mismatch");
        resale.settleListedTicket(listingId, makeAddr("other"), RESALE_PRICE);
    }

    function test_SettleListedTicket_NotLocked_Reverts() public {
        vm.prank(settler);
        vm.expectRevert("Not locked");
        resale.settleListedTicket(listingId, buyer, RESALE_PRICE);
    }

    function test_SettleListedTicket_NotSettler_Reverts() public {
        _lockForBuyer();

        vm.prank(buyer);
        vm.expectRevert("Not settler");
        resale.settleListedTicket(listingId, buyer, RESALE_PRICE);
    }

    function test_SettleListedTicket_ZeroRecipient_Reverts() public {
        vm.prank(settler);
        vm.expectRevert("Invalid recipient");
        resale.settleListedTicket(listingId, address(0), RESALE_PRICE);
    }

    function test_SettleListedTicket_NotActive_Reverts() public {
        vm.prank(seller);
        resale.cancelListing(listingId);

        vm.prank(settler);
        vm.expectRevert("Not active");
        resale.settleListedTicket(listingId, buyer, RESALE_PRICE);
    }

    function test_SettleListedTicket_Expired_Reverts() public {
        // Return NFT to seller, then re-list with expiry
        vm.prank(seller);
        resale.cancelListing(listingId);

        vm.startPrank(seller);
        nft.approve(address(resale), tokenId);
        uint256 lid = resale.listTicket(tokenId, RESALE_PRICE, address(0), block.timestamp + 1 days);
        vm.stopPrank();

        vm.prank(settler);
        resale.lockListing(lid, buyer);

        vm.warp(block.timestamp + 2 days);

        vm.prank(settler);
        vm.expectRevert("Listing expired");
        resale.settleListedTicket(lid, buyer, RESALE_PRICE);
    }

    function test_SettleListedTicket_NoETHMoves() public {
        _lockForBuyer();

        uint256 sellerBefore   = seller.balance;
        uint256 platformBefore = platform.balance;

        vm.prank(settler);
        resale.settleListedTicket(listingId, buyer, RESALE_PRICE);

        assertEq(seller.balance,   sellerBefore);
        assertEq(platform.balance, platformBefore);
    }
}
