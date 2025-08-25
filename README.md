# Web3 Auction dApp — Shardeum Unstablenet (Chain ID 8080)

English auctions on-chain: seller creates an auction, bidders bid with SHM, highest bid wins, refunds via withdraw pattern, and anyone can finalize after the end time.

## How it fits the PayFi brief
- **Peer-to-Peer payments**: bids paid from MetaMask using test SHM.
- **On-chain rules**: highest bid tracked and enforced by smart contract.
- **Utility dApp**: transparent auctions; refunds for losing bidders.
- **Unstablenet-ready**: RPC https://api-unstable.shardeum.org, Chain ID 8080.

## 1) Deploy the contract
```bash
cd onchain
cp .env.example .env # paste your PRIVATE_KEY (with 0x prefix)
npm install
npm run compile
npm run deploy:shm
# copy the deployed address printed in the console
```

## 2) Start the frontend
```bash
cd ../frontend
cp .env.example .env
# set VITE_CONTRACT_ADDRESS to the deployed address
npm install
npm run dev
```
Open the printed local URL. The app will switch/add **Unstablenet** automatically.

## Demo
1. **Create Auction** — Title/URI, Duration, Reserve → Create (show tx).
2. **Bid** — Increase bids from another wallet.
3. **Withdraw** — Losing bidder withdraws.
4. **End** — After timer ends, finalize; seller gets funds if reserve met.
5. Show tx on **Explorer**.

## Contract functions
- `createAuction(durationSeconds, reservePrice, title, uri) -> auctionId`
- `getAuction(auctionId)` → returns full details
- `bid(auctionId)` payable
- `withdraw(auctionId)`
- `endAuction(auctionId)`
- `cancelAuction(auctionId)` (before first bid)
