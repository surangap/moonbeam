import "@polkadot/api-augment";
import "@moonbeam-network/api-augment";
import { expect } from "chai";
import { ALITH_ADDRESS, BALTATHAR_ADDRESS, CHARLETH_ADDRESS } from "../../util/accounts";

import { describeDevMoonbeam } from "../../util/setup-dev-tests";
import { getCompiled } from "../../util/contracts";
import { ethers } from "ethers";
import {
    ALITH_TRANSACTION_TEMPLATE,
    BALTATHAR_TRANSACTION_TEMPLATE, CHARLETH_TRANSACTION_TEMPLATE,
    createTransaction,
} from "../../util/transactions";
import {
  CONTRACT_PROXY_TYPE_ANY,
  CONTRACT_PROXY_TYPE_GOVERNANCE,
  CONTRACT_PROXY_TYPE_STAKING,
  PRECOMPILE_PROXY_ADDRESS,
} from "../../util/constants";
import { expectEVMResult, extractRevertReason } from "../../util/eth-transactions";
import { web3EthCall } from "../../util/providers";

const PROXY_CONTRACT_JSON = getCompiled("precompiles/proxy/Proxy");
const PROXY_INTERFACE = new ethers.utils.Interface(PROXY_CONTRACT_JSON.contract.abi);

describeDevMoonbeam("Precompile - Proxy - add proxy fails if pre-existing proxy", (context) => {
  before("add proxy account", async () => {
    const { result } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_STAKING,
          0,
        ]),
      })
    );
    expectEVMResult(result.events, "Succeed");
  });

  it("should fail re-adding proxy account", async () => {
    const { result } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_STAKING,
          0,
        ]),
      })
    );
    expectEVMResult(result.events, "Revert");

    const revertReason = await extractRevertReason(result.hash, context.ethers);
    expect(revertReason).to.contain("Cannot add more than one proxy");
  });
});

describeDevMoonbeam("Precompile - Proxy - add proxy succeeds with valid account", (context) => {
  it("should add proxy", async () => {
    const { result } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_STAKING,
          0,
        ]),
      })
    );
    expectEVMResult(result.events, "Succeed");

    const proxyAddedEvents = result.events.reduce((acc, e) => {
      if (context.polkadotApi.events.proxy.ProxyAdded.is(e.event)) {
        acc.push({
          account: e.event.data[0].toString(),
          proxyType: e.event.data[2].toHuman(),
        });
      }
      return acc;
    }, []);

    expect(proxyAddedEvents).to.deep.equal([
      {
        account: ALITH_ADDRESS,
        proxyType: "Staking",
      },
    ]);
  });
});

describeDevMoonbeam("Precompile - Proxy - remove proxy fails if no existing proxy", (context) => {
  it("should fail removing proxy account", async () => {
    const { result } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("removeProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_STAKING,
          0,
        ]),
      })
    );
    expectEVMResult(result.events, "Revert");

    const revertReason = await extractRevertReason(result.hash, context.ethers);
    // Full error expected
    // Dispatched call failed with error: Module(ModuleError { index: 22, error: [1, 0, 0, 0],
    // message: Some("NotFound") } )
    expect(revertReason).to.contain("NotFound");
  });
});

describeDevMoonbeam("Precompile - Proxy - remove proxy succeeds if existing proxy", (context) => {
  before("add proxy account", async () => {
    const { result } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_STAKING,
          0,
        ]),
      })
    );
    expectEVMResult(result.events, "Succeed");
  });

  it("should fail re-adding proxy account", async () => {
    const { result } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("removeProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_STAKING,
          0,
        ]),
      })
    );
    expectEVMResult(result.events, "Succeed");

    const proxyRemovedEvents = result.events.reduce((acc, e) => {
      if (context.polkadotApi.events.proxy.ProxyRemoved.is(e.event)) {
        acc.push({
          account: e.event.data[0].toString(),
          proxyType: e.event.data[2].toHuman(),
        });
      }
      return acc;
    }, []);

    expect(proxyRemovedEvents).to.deep.equal([
      {
        account: ALITH_ADDRESS,
        proxyType: "Staking",
      },
    ]);
  });
});

describeDevMoonbeam(
  "Precompile - Proxy - remove proxies succeeds even if no existing proxy",
  (context) => {
    it("should fail removing proxy account", async () => {
      const { result } = await context.createBlock(
        createTransaction(context, {
          ...ALITH_TRANSACTION_TEMPLATE,
          to: PRECOMPILE_PROXY_ADDRESS,
          data: PROXY_INTERFACE.encodeFunctionData("removeProxies"),
        })
      );
      expectEVMResult(result.events, "Succeed");
    });
  }
);

describeDevMoonbeam("Precompile - Proxy - remove proxies succeeds if existing proxy", (context) => {
  before("add 2 proxy accounts", async () => {
    const { result: resultBaltathar } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_STAKING,
          0,
        ]),
      })
    );
    expectEVMResult(resultBaltathar.events, "Succeed");

    const { result: resultCharleth } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
          CHARLETH_ADDRESS,
          CONTRACT_PROXY_TYPE_GOVERNANCE,
          0,
        ]),
      })
    );
    expectEVMResult(resultCharleth.events, "Succeed");
  });

  it("should remove all proxy accounts", async () => {
    const proxiesBefore = (
      await context.polkadotApi.query.proxy.proxies(ALITH_ADDRESS)
    )[0].toJSON();
    expect(proxiesBefore).to.have.lengthOf(2);

    const { result } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("removeProxies"),
      })
    );
    expectEVMResult(result.events, "Succeed");

    const proxiesAfter = (await context.polkadotApi.query.proxy.proxies(ALITH_ADDRESS))[0].toJSON();
    expect(proxiesAfter).to.be.empty;
  });
});

describeDevMoonbeam("Precompile - Proxy - is proxy - fails if incorrect delay", (context) => {
  before("add proxy account", async () => {
    const { result } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_STAKING,
          0,
        ]),
      })
    );
    expectEVMResult(result.events, "Succeed");
  });

  it("should return false", async () => {
    const { result } = await web3EthCall(context.web3, {
      to: PRECOMPILE_PROXY_ADDRESS,
      data: PROXY_INTERFACE.encodeFunctionData("isProxy", [
        ALITH_ADDRESS,
        BALTATHAR_ADDRESS,
        CONTRACT_PROXY_TYPE_STAKING,
        1,
      ]),
    });
    expect(Number(result)).to.equal(0);
  });
});

describeDevMoonbeam("Precompile - Proxy - is proxy - fails if incorrect proxyType", (context) => {
  before("add proxy account", async () => {
    const { result } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_STAKING,
          0,
        ]),
      })
    );
    expectEVMResult(result.events, "Succeed");
  });

  it("should return false", async () => {
    const { result } = await web3EthCall(context.web3, {
      to: PRECOMPILE_PROXY_ADDRESS,
      data: PROXY_INTERFACE.encodeFunctionData("isProxy", [
        ALITH_ADDRESS,
        BALTATHAR_ADDRESS,
        CONTRACT_PROXY_TYPE_ANY,
        0,
      ]),
    });
    expect(Number(result)).to.equal(0);
  });
});

describeDevMoonbeam("Precompile - Proxy - is proxy - succeeds if exists", (context) => {
  before("add proxy account", async () => {
    const { result } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_STAKING,
          0,
        ]),
      })
    );
    expectEVMResult(result.events, "Succeed");
  });

  it("should return true", async () => {
    const { result } = await web3EthCall(context.web3, {
      to: PRECOMPILE_PROXY_ADDRESS,
      data: PROXY_INTERFACE.encodeFunctionData("isProxy", [
        ALITH_ADDRESS,
        BALTATHAR_ADDRESS,
        CONTRACT_PROXY_TYPE_STAKING,
        0,
      ]),
    });
    expect(Number(result)).to.equal(1);
  });
});

describeDevMoonbeam("Pallet proxy - shouldn't accept unknown proxy", (context) => {
  it("shouldn't accept unknown proxy", async function () {
    context.web3.eth.handleRevert = true;
    const beforeCharlethBalance = BigInt(await context.web3.eth.getBalance(CHARLETH_ADDRESS));
    const {
      result: { events, hash },
    } = await context.createBlock(
      createTransaction(context, {
        ...BALTATHAR_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("proxy", [ALITH_ADDRESS, CHARLETH_ADDRESS, []]),
        value: 100,
      })
    );

    expectEVMResult(events, "Revert");
    const revertReason = await extractRevertReason(hash, context.ethers);
    expect(revertReason).to.contain("Not proxy");
    const afterCharlethBalance = BigInt(await context.web3.eth.getBalance(CHARLETH_ADDRESS));
    expect(afterCharlethBalance - beforeCharlethBalance).to.be.eq(0n);
  });
});

describeDevMoonbeam("Pallet proxy - should accept known proxy", (context) => {
  it("should accept known proxy", async () => {
    const beforeCharlethBalance = BigInt(await context.web3.eth.getBalance(CHARLETH_ADDRESS));
    const {
      result: { events },
    } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_ANY,
          0,
        ]),
      })
    );
    expectEVMResult(events, "Succeed");

    const {
      result: { events: events2, hash: hash2 },
    } = await context.createBlock(
      createTransaction(context, {
        ...BALTATHAR_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("proxy", [ALITH_ADDRESS, CHARLETH_ADDRESS, []]),
        value: "0x64",
      })
    );
    expectEVMResult(events2, "Succeed");
    const afterCharlethBalance = BigInt(await context.web3.eth.getBalance(CHARLETH_ADDRESS));
    expect(afterCharlethBalance - beforeCharlethBalance).to.be.eq(100n);
  });
});

describeDevMoonbeam("Pallet proxy - shouldn't accept removed proxy", (context) => {
  it("shouldn't accept removed proxy", async () => {
    const beforeCharlethBalance = BigInt(await context.web3.eth.getBalance(CHARLETH_ADDRESS));
    const {
      result: { events },
    } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_ANY,
          0,
        ]),
      })
    );
    expectEVMResult(events, "Succeed");

    const {
      result: { events: events2 },
    } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("removeProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_ANY,
          0,
        ]),
      })
    );
    expectEVMResult(events2, "Succeed");

    const {
      result: { events: events3, hash: hash3 },
    } = await context.createBlock(
      createTransaction(context, {
        ...BALTATHAR_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("proxy", [ALITH_ADDRESS, CHARLETH_ADDRESS, []]),
        value: "0x64",
      })
    );
    expectEVMResult(events3, "Revert");

    const revertReason = await extractRevertReason(hash3, context.ethers);
    expect(revertReason).to.contain("Not proxy");
    const afterCharlethBalance = BigInt(await context.web3.eth.getBalance(CHARLETH_ADDRESS));
    expect(afterCharlethBalance - beforeCharlethBalance).to.be.eq(0n);
  });
});

describeDevMoonbeam("Pallet proxy - shouldn't accept instant for delayed proxy", (context) => {
  it("shouldn't accept instant for delayed proxy", async () => {
    const beforeCharlethBalance = BigInt(await context.web3.eth.getBalance(CHARLETH_ADDRESS));
    const {
      result: { events },
    } = await context.createBlock(
      createTransaction(context, {
        ...ALITH_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
          BALTATHAR_ADDRESS,
          CONTRACT_PROXY_TYPE_ANY,
          2,
        ]),
      })
    );
    expectEVMResult(events, "Succeed");

    const {
      result: { events: events2, hash: hash2 },
    } = await context.createBlock(
      createTransaction(context, {
        ...BALTATHAR_TRANSACTION_TEMPLATE,
        to: PRECOMPILE_PROXY_ADDRESS,
        data: PROXY_INTERFACE.encodeFunctionData("proxy", [ALITH_ADDRESS, CHARLETH_ADDRESS, []]),
        value: "0x64",
      })
    );
    expectEVMResult(events2, "Revert");
    const revertReason = await extractRevertReason(hash2, context.ethers);
    expect(revertReason).to.contain("Unannounced");
    const afterCharlethBalance = BigInt(await context.web3.eth.getBalance(CHARLETH_ADDRESS));
    expect(afterCharlethBalance - beforeCharlethBalance).to.be.eq(0n);
  });
});

describeDevMoonbeam("Pallet proxy - precompile proxy call value transfer - double charge to caller issue", (context) => {
    it.only("precompile proxy call value transfer - double charge to caller issue", async () => {
        // Make charlie a proxy of alice
        const {
            result: { events },
        } = await context.createBlock(
            createTransaction(context, {
                ...ALITH_TRANSACTION_TEMPLATE,
                to: PRECOMPILE_PROXY_ADDRESS,
                data: PROXY_INTERFACE.encodeFunctionData("addProxy", [
                    CHARLETH_ADDRESS,
                    CONTRACT_PROXY_TYPE_ANY,
                    0,
                ]),
            })
        );
        expectEVMResult(events, "Succeed");

        // note the balance now
        const beforeCharlethBalance = BigInt(await context.web3.eth.getBalance(CHARLETH_ADDRESS));
        const beforeAlithBalance = BigInt(await context.web3.eth.getBalance(ALITH_ADDRESS));
        const otherAddress = await context.web3.eth.accounts.create();
        const beforeOtherBalance = BigInt(await context.web3.eth.getBalance(otherAddress.address));
        const beforeProxyPrecompileBalance = BigInt(await context.web3.eth.getBalance(PRECOMPILE_PROXY_ADDRESS));

        // call precompile proxy to send otherAddress a value of 10^20 (use a big value for the visibility in diff)
        const {
            result: { events: events2, hash: hash2 },
        } = await context.createBlock(
            createTransaction(context, {
                ...CHARLETH_TRANSACTION_TEMPLATE,
                to: PRECOMPILE_PROXY_ADDRESS,
                data: PROXY_INTERFACE.encodeFunctionData("proxy", [ALITH_ADDRESS, otherAddress.address, []]),
                value: "0x056BC75E2D63100000", //10^20
            })
        );
        expectEVMResult(events2, "Succeed");
        //check balances
        const afterOtherBalance = BigInt(await context.web3.eth.getBalance(otherAddress.address));
        const afterCharlethBalance = BigInt(await context.web3.eth.getBalance(CHARLETH_ADDRESS));
        const afterAlithBalance = BigInt(await context.web3.eth.getBalance(ALITH_ADDRESS));
        const afterProxyPrecompileBalance = BigInt(await context.web3.eth.getBalance(PRECOMPILE_PROXY_ADDRESS));

        console.log("\n---balances before---")
        console.log("other: ", beforeOtherBalance)
        console.log("proxyPreocmpile:", beforeProxyPrecompileBalance)
        console.log("charlie:", beforeCharlethBalance)
        console.log("alith:", beforeAlithBalance)

        console.log("\n---balances after---")
        console.log("other: ", afterOtherBalance)
        console.log("proxyPreocmpile:", afterProxyPrecompileBalance) // <- here the precompile should not have final balance of 10^20
        console.log("charlie:", afterCharlethBalance)
        console.log("alith:", afterAlithBalance)

        //check that charlie is charged more than 10^20 (twice 10^20 + gas)
        const charlieBalanceDiff = beforeCharlethBalance - afterCharlethBalance;
        console.log("charlie balance diff: ", charlieBalanceDiff);
        expect(charlieBalanceDiff > 2 * Math.pow(10, 20)).to.true;
    });
});
