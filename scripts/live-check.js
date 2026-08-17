// Live functional smoke test against the deployed Sepolia contract.
// Exercises: mint, wrong-payment rejection, approve+transferFrom, and
// owner-only check-in enforcement, using real transactions on testnet.
//
// Usage: npx hardhat run scripts/live-check.js --network sepolia
const hre = require("hardhat");
const { ethers } = hre;
const { loadContractAddress } = require("./lib/loadDeployment");

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✔ ${msg}`);
}

async function expectRevert(promise, label) {
  try {
    await (await promise).wait();
    throw new Error(`Expected revert (${label}) but transaction succeeded`);
  } catch (err) {
    if (err.message.startsWith("Expected revert")) throw err;
    console.log(`  ✔ reverted as expected: ${label}`);
  }
}

async function main() {
  const address = loadContractAddress(hre);
  const [owner] = await ethers.getSigners();
  const provider = ethers.provider;

  const walletB = ethers.Wallet.createRandom().connect(provider);
  const walletC = ethers.Wallet.createRandom().connect(provider);
  console.log(`Contract: ${address}`);
  console.log(`Owner:    ${owner.address}`);
  console.log(`WalletB:  ${walletB.address} (fresh, will mint)`);
  console.log(`WalletC:  ${walletC.address} (fresh, will receive via approve+transferFrom)\n`);

  const ticket = await ethers.getContractAt("EventTicket", address, owner);
  const price = await ticket.ticketPrice();

  console.log("Funding walletB and walletC from owner for gas + mint price...");
  await (await owner.sendTransaction({ to: walletB.address, value: price + ethers.parseEther("0.001") })).wait();
  await (await owner.sendTransaction({ to: walletC.address, value: ethers.parseEther("0.0006") })).wait();
  console.log("  done\n");

  console.log("1) Minting a ticket from a brand-new wallet (walletB)...");
  const ticketAsB = ticket.connect(walletB);
  const mintTx = await ticketAsB.mint({ value: price });
  const mintReceipt = await mintTx.wait();
  const mintedEvent = mintReceipt.logs.map((l) => { try { return ticket.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "TicketMinted");
  const tokenId = mintedEvent.args.tokenId;
  console.log(`  tx: ${mintTx.hash}`);
  assert((await ticket.ownerOf(tokenId)) === walletB.address, `ownerOf(${tokenId}) is walletB`);
  assert((await ticket.balanceOf(walletB.address)) === 1n, "walletB balance is 1");

  console.log("\n2) Attempting to mint with the wrong payment amount (should revert)...");
  await expectRevert(ticketAsB.mint({ value: price - 1n }), "WrongPayment");

  console.log("\n3) walletB approves walletC, walletC pulls the ticket via transferFrom...");
  await (await ticketAsB.approve(walletC.address, tokenId)).wait();
  assert((await ticket.getApproved(tokenId)) === walletC.address, "approval recorded on-chain");
  const ticketAsC = ticket.connect(walletC);
  const transferTx = await ticketAsC.transferFrom(walletB.address, walletC.address, tokenId);
  await transferTx.wait();
  console.log(`  tx: ${transferTx.hash}`);
  assert((await ticket.ownerOf(tokenId)) === walletC.address, `ownerOf(${tokenId}) is now walletC`);
  assert((await ticket.balanceOf(walletB.address)) === 0n, "walletB balance back to 0");

  console.log("\n4) Ticket holder (walletC) attempts self check-in (should revert, owner-only)...");
  await expectRevert(ticket.connect(walletC).checkIn(tokenId), "OwnableUnauthorizedAccount");

  console.log("\n5) Contract owner checks the ticket in...");
  const checkInTx = await ticket.checkIn(tokenId);
  await checkInTx.wait();
  console.log(`  tx: ${checkInTx.hash}`);
  assert((await ticket.checkedIn(tokenId)) === true, "checkedIn is true");

  console.log("\n6) Re-checking in the same ticket again (should revert, already checked in)...");
  await expectRevert(ticket.checkIn(tokenId), "AlreadyCheckedIn");

  console.log("\n✅ All live functional checks passed on Sepolia.");
}

main().catch((error) => {
  console.error("\n❌ Live check failed:", error);
  process.exitCode = 1;
});
