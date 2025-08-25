// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AuctionHouse is ReentrancyGuard {
    struct Auction {
        address payable seller;
        string title;
        string uri;
        uint256 endTime;
        uint256 reservePrice;
        address highestBidder;
        uint256 highestBid;
        bool settled;
        bool canceled;
    }

    uint256 public auctionCount;
    mapping(uint256 => Auction) private _auctions;
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;

    event AuctionCreated(uint256 indexed auctionId, address indexed seller, string title, string uri, uint256 endTime, uint256 reservePrice);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed auctionId, address winner, uint256 amount, bool reserveMet);
    event Withdrawal(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event Canceled(uint256 indexed auctionId);

    modifier exists(uint256 auctionId) {
        require(auctionId > 0 && auctionId <= auctionCount, "Invalid auction");
        _;
    }

    modifier onlySeller(uint256 auctionId) {
        require(msg.sender == _auctions[auctionId].seller, "Not seller");
        _;
    }

    function createAuction(uint256 durationSeconds, uint256 reservePrice, string calldata title, string calldata uri) external returns (uint256 auctionId) {
        require(durationSeconds >= 60, "Min duration 60s");
        auctionId = ++auctionCount;
        Auction storage a = _auctions[auctionId];
        a.seller = payable(msg.sender);
        a.title = title;
        a.uri = uri;
        a.endTime = block.timestamp + durationSeconds;
        a.reservePrice = reservePrice;
        emit AuctionCreated(auctionId, msg.sender, title, uri, a.endTime, reservePrice);
    }

    function getAuction(uint256 auctionId) external view exists(auctionId) returns (
        address seller, string memory title, string memory uri, uint256 endTime, uint256 reservePrice,
        address highestBidder, uint256 highestBid, bool settled, bool canceled
    ) {
        Auction storage a = _auctions[auctionId];
        return (a.seller, a.title, a.uri, a.endTime, a.reservePrice, a.highestBidder, a.highestBid, a.settled, a.canceled);
    }

    function bid(uint256 auctionId) external payable nonReentrant exists(auctionId) {
        Auction storage a = _auctions[auctionId];
        require(!a.canceled, "Canceled");
        require(block.timestamp < a.endTime, "Ended");
        require(!a.settled, "Settled");
        require(msg.sender != a.seller, "Seller cannot bid");
        require(msg.value > a.highestBid, "Bid too low");

        if (a.highestBidder != address(0)) {
            pendingReturns[auctionId][a.highestBidder] += a.highestBid;
        }

        a.highestBidder = msg.sender;
        a.highestBid = msg.value;

        emit BidPlaced(auctionId, msg.sender, msg.value);
    }

    function withdraw(uint256 auctionId) external nonReentrant exists(auctionId) {
        uint256 amount = pendingReturns[auctionId][msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingReturns[auctionId][msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Withdraw failed");
        emit Withdrawal(auctionId, msg.sender, amount);
    }

    function endAuction(uint256 auctionId) external nonReentrant exists(auctionId) {
        Auction storage a = _auctions[auctionId];
        require(!a.canceled, "Canceled");
        require(!a.settled, "Already settled");
        require(block.timestamp >= a.endTime, "Not ended");

        a.settled = true;
        bool reserveMet = a.highestBid >= a.reservePrice && a.highestBidder != address(0);

        if (reserveMet) {
            (bool ok, ) = a.seller.call{value: a.highestBid}("");
            require(ok, "Payout failed");
            emit AuctionEnded(auctionId, a.highestBidder, a.highestBid, true);
        } else {
            if (a.highestBidder != address(0) && a.highestBid > 0) {
                pendingReturns[auctionId][a.highestBidder] += a.highestBid;
            }
            emit AuctionEnded(auctionId, address(0), 0, false);
        }
    }

    function cancelAuction(uint256 auctionId) external exists(auctionId) onlySeller(auctionId) {
        Auction storage a = _auctions[auctionId];
        require(!a.canceled, "Already canceled");
        require(a.highestBid == 0, "Cannot cancel after bids");
        a.canceled = true;
        emit Canceled(auctionId);
    }
}
