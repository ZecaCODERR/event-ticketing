const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("EventTicket", function () {
  const NAME = "Zeca Arc Live";
  const SYMBOL = "ZATIX";
  const BASE_URI = "ipfs://test-cid/";
  const MAX_SUPPLY = 3;
  const PRICE = ethers.parseEther("0.01");
  const MAX_PER_WALLET = 2;

  async function deployFixture() {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const now = await time.latest();
    const mintStart = now;
    const mintEnd = now + 3600;

    const Factory = await ethers.getContractFactory("EventTicket");
    const ticket = await Factory.deploy(
      NAME,
      SYMBOL,
      BASE_URI,
      MAX_SUPPLY,
      PRICE,
      MAX_PER_WALLET,
      mintStart,
      mintEnd,
      owner.address
    );
    await ticket.waitForDeployment();
    return { ticket, owner, alice, bob, carol, mintStart, mintEnd };
  }

  it("sets constructor params correctly", async function () {
    const { ticket, owner } = await deployFixture();
    expect(await ticket.name()).to.equal(NAME);
    expect(await ticket.symbol()).to.equal(SYMBOL);
    expect(await ticket.maxSupply()).to.equal(MAX_SUPPLY);
    expect(await ticket.ticketPrice()).to.equal(PRICE);
    expect(await ticket.maxPerWallet()).to.equal(MAX_PER_WALLET);
    expect(await ticket.owner()).to.equal(owner.address);
    expect(await ticket.totalMinted()).to.equal(0);
  });

  it("mints a ticket on payment of exact price and emits TicketMinted", async function () {
    const { ticket, alice } = await deployFixture();
    await expect(ticket.connect(alice).mint({ value: PRICE }))
      .to.emit(ticket, "TicketMinted")
      .withArgs(alice.address, 1);

    expect(await ticket.ownerOf(1)).to.equal(alice.address);
    expect(await ticket.balanceOf(alice.address)).to.equal(1);
    expect(await ticket.totalMinted()).to.equal(1);
    expect(await ticket.remainingSupply()).to.equal(MAX_SUPPLY - 1);
  });

  it("rejects incorrect payment amount", async function () {
    const { ticket, alice } = await deployFixture();
    await expect(
      ticket.connect(alice).mint({ value: ethers.parseEther("0.005") })
    ).to.be.revertedWithCustomError(ticket, "WrongPayment");
  });

  it("enforces the per-wallet mint limit", async function () {
    const { ticket, alice } = await deployFixture();
    await ticket.connect(alice).mint({ value: PRICE });
    await ticket.connect(alice).mint({ value: PRICE });
    await expect(ticket.connect(alice).mint({ value: PRICE })).to.be.revertedWithCustomError(
      ticket,
      "WalletLimitReached"
    );
  });

  it("enforces max supply (sells out)", async function () {
    const { ticket, alice, bob, carol } = await deployFixture();
    await ticket.connect(alice).mint({ value: PRICE }); // 1
    await ticket.connect(bob).mint({ value: PRICE }); // 2
    await ticket.connect(carol).mint({ value: PRICE }); // 3 == MAX_SUPPLY
    await expect(ticket.connect(alice).mint({ value: PRICE })).to.be.revertedWithCustomError(
      ticket,
      "SoldOut"
    );
  });

  it("rejects minting outside the mint window", async function () {
    const [owner, alice] = await ethers.getSigners();
    const now = await time.latest();
    const Factory = await ethers.getContractFactory("EventTicket");
    const futureTicket = await Factory.deploy(
      NAME,
      SYMBOL,
      BASE_URI,
      MAX_SUPPLY,
      PRICE,
      MAX_PER_WALLET,
      now + 1000, // starts in the future
      now + 2000,
      owner.address
    );
    await futureTicket.waitForDeployment();

    await expect(
      futureTicket.connect(alice).mint({ value: PRICE })
    ).to.be.revertedWithCustomError(futureTicket, "MintNotOpen");
  });

  it("lets a ticket holder freely transfer their ticket", async function () {
    const { ticket, alice, bob } = await deployFixture();
    await ticket.connect(alice).mint({ value: PRICE });

    await expect(
      ticket.connect(alice)["safeTransferFrom(address,address,uint256)"](alice.address, bob.address, 1)
    )
      .to.emit(ticket, "Transfer")
      .withArgs(alice.address, bob.address, 1);

    expect(await ticket.ownerOf(1)).to.equal(bob.address);
    expect(await ticket.balanceOf(alice.address)).to.equal(0);
    expect(await ticket.balanceOf(bob.address)).to.equal(1);
  });

  it("prevents a non-owner from transferring someone else's ticket", async function () {
    const { ticket, alice, bob } = await deployFixture();
    await ticket.connect(alice).mint({ value: PRICE });

    await expect(
      ticket.connect(bob)["safeTransferFrom(address,address,uint256)"](alice.address, bob.address, 1)
    ).to.be.reverted;
  });

  it("only the contract owner can check in a ticket, and not twice", async function () {
    const { ticket, owner, alice } = await deployFixture();
    await ticket.connect(alice).mint({ value: PRICE });

    await expect(ticket.connect(alice).checkIn(1)).to.be.revertedWithCustomError(
      ticket,
      "OwnableUnauthorizedAccount"
    );

    await expect(ticket.connect(owner).checkIn(1))
      .to.emit(ticket, "TicketCheckedIn")
      .withArgs(1, owner.address);
    expect(await ticket.checkedIn(1)).to.equal(true);

    await expect(ticket.connect(owner).checkIn(1)).to.be.revertedWithCustomError(
      ticket,
      "AlreadyCheckedIn"
    );
  });

  it("lets the owner withdraw proceeds", async function () {
    const { ticket, owner, alice, bob } = await deployFixture();
    await ticket.connect(alice).mint({ value: PRICE });
    await ticket.connect(bob).mint({ value: PRICE });

    const contractAddress = await ticket.getAddress();
    const before = await ethers.provider.getBalance(owner.address);
    const contractBalance = await ethers.provider.getBalance(contractAddress);
    expect(contractBalance).to.equal(PRICE * 2n);

    const tx = await ticket.connect(owner).withdraw();
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    const after = await ethers.provider.getBalance(owner.address);
    expect(after).to.equal(before + contractBalance - gasCost);
    expect(await ethers.provider.getBalance(contractAddress)).to.equal(0);
  });

  it("returns correct tokenURI using base URI", async function () {
    const { ticket, alice } = await deployFixture();
    await ticket.connect(alice).mint({ value: PRICE });
    expect(await ticket.tokenURI(1)).to.equal(`${BASE_URI}1`);
  });
});
