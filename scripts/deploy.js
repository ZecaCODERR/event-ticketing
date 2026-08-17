const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const {
    EVENT_NAME = "Zeca Arc Live",
    EVENT_SYMBOL = "ZATIX",
    BASE_URI = "ipfs://REPLACE_WITH_YOUR_METADATA_CID/",
    MAX_SUPPLY = "500",
    TICKET_PRICE_ETH = "0.01",
    MAX_PER_WALLET = "4",
    MINT_START,
    MINT_END,
  } = process.env;

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No signer available. Set SEPOLIA_RPC_URL and PRIVATE_KEY in .env before deploying to a live network."
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const mintStart = MINT_START ? Number(MINT_START) : now;
  const mintEnd = MINT_END ? Number(MINT_END) : now + 30 * 24 * 60 * 60; // +30 days

  const ticketPrice = hre.ethers.parseEther(TICKET_PRICE_ETH);

  console.log("Deploying EventTicket with:");
  console.log({
    name: EVENT_NAME,
    symbol: EVENT_SYMBOL,
    baseURI: BASE_URI,
    maxSupply: MAX_SUPPLY,
    ticketPriceEth: TICKET_PRICE_ETH,
    maxPerWallet: MAX_PER_WALLET,
    mintStart: new Date(mintStart * 1000).toISOString(),
    mintEnd: new Date(mintEnd * 1000).toISOString(),
    deployer: deployer.address,
  });

  const EventTicket = await hre.ethers.getContractFactory("EventTicket");
  const contract = await EventTicket.deploy(
    EVENT_NAME,
    EVENT_SYMBOL,
    BASE_URI,
    MAX_SUPPLY,
    ticketPrice,
    MAX_PER_WALLET,
    mintStart,
    mintEnd,
    deployer.address
  );

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\n✅ EventTicket deployed to: ${address}`);
  console.log(`   Network: ${hre.network.name}`);

  const deploymentInfo = {
    network: hre.network.name,
    address,
    deployer: deployer.address,
    args: {
      name: EVENT_NAME,
      symbol: EVENT_SYMBOL,
      baseURI: BASE_URI,
      maxSupply: MAX_SUPPLY,
      ticketPriceWei: ticketPrice.toString(),
      maxPerWallet: MAX_PER_WALLET,
      mintStart,
      mintEnd,
      owner: deployer.address,
    },
    timestamp: new Date().toISOString(),
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${hre.network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(deploymentInfo, null, 2));
  console.log(`   Saved deployment info to ${path.relative(process.cwd(), file)}`);

  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log(
      `\nTo verify on Etherscan, run:\n  npx hardhat verify --network ${hre.network.name} ${address} "${EVENT_NAME}" "${EVENT_SYMBOL}" "${BASE_URI}" ${MAX_SUPPLY} ${ticketPrice} ${MAX_PER_WALLET} ${mintStart} ${mintEnd} ${deployer.address}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
