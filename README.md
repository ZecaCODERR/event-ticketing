# Event Ticketing (ERC-721, Ethereum Sepolia)

An event ticket is an ERC-721 NFT. Fans **mint** a ticket directly from the
contract (pay `ticketPrice`, get a token), **own** it in their own wallet
(no custodial database — `ownerOf(tokenId)` is the source of truth), and can
**transfer** it to anyone at any time using standard ERC-721 transfer calls
(e.g. resale, gifting).

## Contents

- `contracts/EventTicket.sol` — the ticket contract (OpenZeppelin ERC721 + Ownable + ReentrancyGuard)
- `test/EventTicket.test.js` — 11 tests covering minting, limits, transfers, check-in, withdrawals
- `scripts/deploy.js` — deploys the contract and saves its address to `deployments/<network>.json`
- `scripts/mint.js` — mint a ticket from the CLI
- `scripts/transfer.js` — transfer a ticket you own to another address
- `scripts/info.js` — print event stats and, optionally, an address's tickets

## Contract design

- **Fixed supply, single event.** `maxSupply`, `ticketPrice`, `maxPerWallet`, and a
  `[mintStart, mintEnd]` window are set once at deploy time and are immutable.
- **`mint()`** — payable, mints token `#N` (sequential) to `msg.sender` if the window is
  open, supply remains, payment is exact, and the wallet is under its limit.
- **Ownership & transfer** — inherited from OpenZeppelin's `ERC721`/`ERC721Burnable`:
  `ownerOf`, `balanceOf`, `transferFrom`, `safeTransferFrom`, `approve`, `setApprovalForAll`
  all work out of the box. No allowlist or freeze on transfers — tickets are freely
  transferable/resellable by default.
- **`checkIn(tokenId)`** — owner-only (event staff), marks a ticket used at the door.
  Does not burn or block further transfers; it's a record, not a lock.
- **`withdraw()`** — owner-only, sweeps collected mint proceeds.
- **Metadata** — `tokenURI(id)` = `baseURI + id`. Point `baseURI` at an IPFS folder
  (e.g. via [nft.storage](https://nft.storage) or [Pinata](https://pinata.cloud)) containing
  `1.json`, `2.json`, ... each following the standard `{name, description, image, attributes}` schema.

## 1. Install

```bash
npm install
```

## 2. Configure

```bash
cp .env.example .env
```

Fill in `.env`:

- **`SEPOLIA_RPC_URL`** — free from [Alchemy](https://dashboard.alchemy.com/) or [Infura](https://app.infura.io/).
- **`PRIVATE_KEY`** — a **burner/dev wallet** private key, funded only with testnet ETH.
  Never use a wallet that holds real funds. Get Sepolia ETH from a faucet:
  - https://www.alchemy.com/faucets/ethereum-sepolia
  - https://cloud.google.com/application/web3/faucet/ethereum/sepolia
- **`ETHERSCAN_API_KEY`** *(optional)* — for contract verification, from https://etherscan.io/apis
- Event params: `EVENT_NAME`, `EVENT_SYMBOL`, `BASE_URI`, `MAX_SUPPLY`, `TICKET_PRICE_ETH`, `MAX_PER_WALLET`

## 3. Test

```bash
npm run compile
npm test
```

## 4. Deploy to Sepolia

```bash
npm run deploy:sepolia
```

This prints the deployed address and writes it to `deployments/sepolia.json` (read
automatically by the other scripts). To verify the source on Etherscan, run the
`hardhat verify` command the deploy script prints for you.

## 5. Mint, check ownership, transfer

```bash
# Mint a ticket to your PRIVATE_KEY wallet
npm run mint:sepolia

# See event stats + a specific address's ticket IDs
OWNER=0xYourAddress npm run info:sepolia

# Transfer ticket #1 to another wallet
TOKEN_ID=1 TO=0xRecipientAddress npm run transfer:sepolia
```

Any wallet can mint directly against the deployed contract from a wallet app
(MetaMask "Write Contract" via Etherscan, or any web3 library) — the CLI
scripts are just a convenience wrapper for the same on-chain calls.

## Security notes

- `PRIVATE_KEY` in `.env` is read locally by Hardhat to sign transactions; it is
  never transmitted anywhere except to the RPC node when submitting the raw
  signed transaction. Still, treat it as a secret and use only a testnet-funded
  burner key. `.env` is gitignored.
- Contract uses OpenZeppelin's audited `ERC721`, `Ownable`, and `ReentrancyGuard`.
  `mint()` and `withdraw()` are `nonReentrant`.
- This is testnet software for learning/prototyping — it has not been audited
  for mainnet use.
