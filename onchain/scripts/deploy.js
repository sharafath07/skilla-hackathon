const hre = require("hardhat");

async function main() {
  const Contract = await hre.ethers.getContractFactory("AuctionHouse");
  const contract = await Contract.deploy();
  await contract.waitForDeployment();
  console.log("AuctionHouse deployed to:", await contract.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
