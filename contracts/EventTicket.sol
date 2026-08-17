// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title EventTicket
/// @notice ERC-721 ticket for a single event. Each token = one ticket.
///         Attendees mint (buy) a ticket directly from the contract, own it
///         in their wallet, and can freely transfer/resell it — standard
///         ERC-721 transfer semantics, no central "issuer" custody required.
contract EventTicket is ERC721, ERC721Burnable, Ownable, ReentrancyGuard {
    /// @notice Max number of tickets that will ever exist.
    uint256 public immutable maxSupply;

    /// @notice Price per ticket, in wei.
    uint256 public immutable ticketPrice;

    /// @notice Max tickets a single wallet may hold from this mint (anti-scalping).
    uint256 public immutable maxPerWallet;

    /// @notice Unix timestamps bounding the public mint window.
    uint256 public immutable mintStart;
    uint256 public immutable mintEnd;

    /// @notice Base URI for token metadata; tokenURI = baseURI + tokenId.
    string private _baseTokenURI;

    /// @notice Number of tickets minted so far. Also used as the next token id (1-indexed).
    uint256 public totalMinted;

    /// @notice Tracks whether a ticket has been checked in / used at the venue.
    mapping(uint256 => bool) public checkedIn;

    event TicketMinted(address indexed to, uint256 indexed tokenId);
    event TicketCheckedIn(uint256 indexed tokenId, address indexed by);

    error MintNotOpen();
    error SoldOut();
    error WrongPayment();
    error WalletLimitReached();
    error NonexistentTicket();
    error AlreadyCheckedIn();
    error WithdrawFailed();

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        uint256 maxSupply_,
        uint256 ticketPrice_,
        uint256 maxPerWallet_,
        uint256 mintStart_,
        uint256 mintEnd_,
        address owner_
    ) ERC721(name_, symbol_) Ownable(owner_) {
        _baseTokenURI = baseURI_;
        maxSupply = maxSupply_;
        ticketPrice = ticketPrice_;
        maxPerWallet = maxPerWallet_;
        mintStart = mintStart_;
        mintEnd = mintEnd_;
    }

    /// @notice Mint one ticket to the caller. Payable — must send exactly `ticketPrice`.
    function mint() external payable nonReentrant returns (uint256 tokenId) {
        if (block.timestamp < mintStart || block.timestamp > mintEnd) revert MintNotOpen();
        if (totalMinted >= maxSupply) revert SoldOut();
        if (msg.value != ticketPrice) revert WrongPayment();
        if (balanceOf(msg.sender) >= maxPerWallet) revert WalletLimitReached();

        totalMinted += 1;
        tokenId = totalMinted;
        _safeMint(msg.sender, tokenId);

        emit TicketMinted(msg.sender, tokenId);
    }

    /// @notice Mark a ticket as used at the door. Only callable by the contract owner
    ///         (e.g. an event-staff wallet or gate-scanning app), not by the ticket holder.
    function checkIn(uint256 tokenId) external onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentTicket();
        if (checkedIn[tokenId]) revert AlreadyCheckedIn();
        checkedIn[tokenId] = true;
        emit TicketCheckedIn(tokenId, msg.sender);
    }

    /// @notice Withdraw collected mint proceeds to the owner.
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        (bool ok, ) = payable(owner()).call{value: balance}("");
        if (!ok) revert WithdrawFailed();
    }

    /// @notice Tickets remaining to be minted.
    function remainingSupply() external view returns (uint256) {
        return maxSupply - totalMinted;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
