import React, { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import abi from "./abi/AuctionHouse.json";
import { short, timeLeft } from "./utils/format";
import './App.css';

const CHAIN_ID_HEX = "0x1F90"; // 8080
const EXPLORER = "https://explorer-unstable.shardeum.org";

export default function App() {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [status, setStatus] = useState("");
  const [contractAddr, setContractAddr] = useState(import.meta.env.VITE_CONTRACT_ADDRESS || "");
  const [count, setCount] = useState(0);
  const [auctions, setAuctions] = useState([]);

  const [title, setTitle] = useState("");
  const [uri, setUri] = useState("");
  const [duration, setDuration] = useState(5);
  const [reserve, setReserve] = useState("0.01");

  const [bidAmount, setBidAmount] = useState("0.02");
  const [lastTx, setLastTx] = useState(null);

  const ready = useMemo(() => typeof window !== "undefined" && !!window.ethereum, []);

  useEffect(() => {
    if (!ready) return;
    const handler = (chainIdHex) => setChainId(parseInt(chainIdHex, 16));
    window.ethereum?.on?.("chainChanged", handler);
    return () => window.ethereum?.removeListener?.("chainChanged", handler);
  }, [ready]);

  async function connect() {
    if (!ready) return alert("MetaMask not found");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAddress(accounts[0]);
    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    setChainId(Number(network.chainId));
    if (Number(network.chainId) !== 8080) await addOrSwitch();
  }

  async function addOrSwitch() {
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
    } catch {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_ID_HEX,
          chainName: "Shardeum Unstablenet",
          nativeCurrency: { name: "SHM", symbol: "SHM", decimals: 18 },
          rpcUrls: ["https://api-unstable.shardeum.org"],
          blockExplorerUrls: [EXPLORER + "/"]
        }]
      });
    }
  }

  async function getSignerAndContract() {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(contractAddr, abi, signer);
  }

  async function refreshCount() {
    const c = await getSignerAndContract();
    const n = await c.auctionCount();
    setCount(Number(n));
    return Number(n);
  }

  async function fetchAuction(id) {
    const c = await getSignerAndContract();
    const a = await c.getAuction(id);
    return {
      id,
      seller: a[0],
      title: a[1],
      uri: a[2],
      endTime: Number(a[3]),
      reservePrice: a[4].toString(),
      highestBidder: a[5],
      highestBid: a[6].toString(),
      settled: a[7],
      canceled: a[8],
    };
  }

  async function refreshLatest(limit = 10) {
    const n = await refreshCount();
    const start = Math.max(1, n - limit + 1);
    const ids = [];
    for (let i = start; i <= n; i++) ids.push(i);
    const list = await Promise.all(ids.map(fetchAuction));
    setAuctions(list.reverse());
  }

  async function createAuction() {
    if (!title) return alert("Enter title");
    setStatus("Creating auction...");
    const c = await getSignerAndContract();
    const tx = await c.createAuction(Number(duration) * 60, parseEther(reserve || "0.01"), title, uri || "");
    setLastTx(tx.hash);
    await tx.wait();
    setStatus("Auction created ✅");
    setTitle(""); setUri("");
    await refreshLatest();
  }

  async function placeBid(id) {
    setStatus("Placing bid...");
    const c = await getSignerAndContract();
    const tx = await c.bid(id, { value: parseEther(bidAmount || "0.02") });
    setLastTx(tx.hash);
    await tx.wait();
    setStatus("Bid placed ✅");
    await refreshLatest();
  }

  async function finalize(id) {
    setStatus("Finalizing auction...");
    const c = await getSignerAndContract();
    const tx = await c.endAuction(id);
    setLastTx(tx.hash);
    await tx.wait();
    setStatus("Auction finalized ✅");
    await refreshLatest();
  }

  async function withdraw(id) {
    setStatus("Withdrawing refunds...");
    const c = await getSignerAndContract();
    const tx = await c.withdraw(id);
    setLastTx(tx.hash);
    await tx.wait();
    setStatus("Withdrawn ✅");
    await refreshLatest();
  }

  useEffect(() => { if (address && contractAddr) refreshLatest(); }, [address, contractAddr]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Auction dApp — Shardeum</h1>
        <div className="header-controls">
          <input
            value={contractAddr}
            onChange={e => setContractAddr(e.target.value)}
            placeholder="Contract address"
            className="input"
          />
          <button onClick={connect} className="btn">
            {address ? short(address) : "Connect"}
          </button>
        </div>
      </header>

      <div className="status-bar">
        {chainId && chainId !== 8080 && (
          <div>⚠️ Switch to Shardeum Unstablenet (8080)</div>
        )}
        {status && <div>• {status}</div>}
        {lastTx && (
          <div>
            • Last tx:{" "}
            <a href={`${EXPLORER}/tx/${lastTx}`} target="_blank" rel="noreferrer">
              {lastTx.slice(0, 10)}...
            </a>
          </div>
        )}
      </div>

      <section className="card">
        <h2 className="section-title">Create Auction</h2>
        <div className="form-grid">
          <div>
            <label>Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="MacBook Pro 13”"
              className="input"
            />
          </div>
          <div>
            <label>URI (image/IPFS)</label>
            <input
              value={uri}
              onChange={e => setUri(e.target.value)}
              placeholder="ipfs://..."
              className="input"
            />
          </div>
          <div>
            <label>Duration (minutes)</label>
            <input
              type="number"
              min="1"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label>Reserve Price (SHM)</label>
            <input
              value={reserve}
              onChange={e => setReserve(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div className="form-actions">
          <button onClick={createAuction} className="btn">
            Create
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <h2 className="section-title">Latest Auctions</h2>
          <button onClick={() => refreshLatest()} className="btn-small">
            Refresh
          </button>
        </div>

        {auctions.length === 0 && <div>No auctions yet</div>}

        <div className="auction-grid">
          {auctions.map(a => (
            <div key={a.id} className="auction-card">
              <div className="auction-title">{a.title}</div>
              <div className="auction-uri">
                {a.uri ? (
                  <a href={a.uri} target="_blank" rel="noreferrer">
                    {a.uri}
                  </a>
                ) : (
                  "No URI"
                )}
              </div>
              <div className="auction-info">
                <span>Seller: {short(a.seller)}</span>
                <span>Ends: {timeLeft(a.endTime)}</span>
              </div>
              <div className="auction-info">
                <span>Highest: {formatEther(a.highestBid)} SHM</span>
                <span>Reserve: {formatEther(a.reservePrice)} SHM</span>
              </div>
              <div className="auction-actions">
                <input
                  value={bidAmount}
                  onChange={e => setBidAmount(e.target.value)}
                  className="input bid-input"
                />
                <button
                  onClick={() => placeBid(a.id)}
                  className="btn"
                  disabled={
                    a.settled ||
                    a.canceled ||
                    a.endTime * 1000 <= Date.now()
                  }
                >
                  Bid
                </button>
                <button
                  onClick={() => finalize(a.id)}
                  className="btn"
                  disabled={
                    a.endTime * 1000 > Date.now() || a.settled || a.canceled
                  }
                >
                  End
                </button>
                <button onClick={() => withdraw(a.id)} className="btn">
                  Withdraw
                </button>
              </div>
              <div className="auction-status">
                {a.canceled ? "Canceled" : a.settled ? "Settled" : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="app-footer">
        Explorer:{" "}
        <a href={EXPLORER} target="_blank" rel="noreferrer">
          {EXPLORER}
        </a>{" "}
        • Chain ID: 8080
      </footer>
    </div>

  );
}
