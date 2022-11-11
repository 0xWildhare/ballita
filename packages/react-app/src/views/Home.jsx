import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useContractReader } from "eth-hooks";
import { useEventListener } from "eth-hooks/events/useEventListener";
import { Button, Col, Menu, Row, InputNumber, Space, List, Card, Spin } from "antd";
import { Address, Balance } from "../components";
import { ethers } from "ethers";

/**
 * web3 props can be passed from '../App.jsx' into your local view component for use
 * @param {*} yourLocalBalance balance on current network
 * @param {*} readContracts contracts from current chain already pre-loaded using ethers contract module. More here https://docs.ethers.io/v5/api/contract/contract/
 * @returns react component
 **/
function Home({
  yourLocalBalance,
  readContracts,
  tx,
  targetNetwork,
  writeContracts,
  address,
  mainnetProvider,
  blockExplorer,
  localProvider,
  price,
 }) {
console.log("rerender",readContracts);
  // you can also use hooks locally in your component of choice
  // in this case, let's keep track of 'purpose' variable from our contract

  const waitingForOracle = useContractReader(readContracts, "Ballita", "waitingForOracle") //untested
  const dateTime = Date.now();
  const timestamp = Math.floor(dateTime / 1000);

  const advanceEvents = useEventListener(readContracts, "Ballita", "AdvanceEpoch", localProvider, 1);
  const [currentEpoch, setCurrentEpoch] = useState(1);
  const [previousEpoch, setPreviousEpoch] = useState(0);
  useEffect(()=>{
    const lastAdvance = advanceEvents&&advanceEvents[advanceEvents.length - 1];
    console.log("lastAdvance", lastAdvance)
    const newCurrentEpoch = lastAdvance&&lastAdvance.args&&lastAdvance.args.newEpoch.toNumber();
    const newPreviousEpoch = lastAdvance&&lastAdvance.args&&lastAdvance.args.previousEpoch.toNumber();
    setCurrentEpoch(newCurrentEpoch);
    setPreviousEpoch(newPreviousEpoch);
  }, [advanceEvents]);
  console.log("📟 advance epoch events:", advanceEvents, advanceEvents.length);
  console.log("advanceEvents", advanceEvents, currentEpoch, previousEpoch);

  const priceEvents = useEventListener(readContracts, "Ballita", "SetPrice", localProvider, 1);
  const [betPrice, setBetPrice] = useState(0);
  useEffect(() => {
    const lastPriceEvent = priceEvents&&priceEvents[priceEvents.length - 1];
    const newPrice = lastPriceEvent&&lastPriceEvent.args&&lastPriceEvent.args.newPrice;
    setBetPrice(newPrice);
  }, [priceEvents]);

  const topNumberEvents = useEventListener(readContracts, "Ballita", "SetTopNumber", localProvider, 1);
  const [topNumber, setTopNumber] = useState(0);
  useEffect(() => {
    const lastTopNumberEvent = topNumberEvents&&topNumberEvents[topNumberEvents.length - 1];
    const newTopNumber = lastTopNumberEvent&&lastTopNumberEvent.args&&lastTopNumberEvent.args.newTopNumber;
    setTopNumber(newTopNumber);
  }, [topNumberEvents]);

  const charityEvents = useEventListener(readContracts, "Ballita", "SetCharity", localProvider, 1);
  const [charity, setCharity] = useState(0);
  useEffect(() => {
    const lastCharityEvent = charityEvents&&charityEvents[charityEvents.length - 1];
    const newCharity = lastCharityEvent&&lastCharityEvent.args&&lastCharityEvent.args.newCharity;
    setCharity(newCharity);
  }, [charityEvents]);


  const charityPercentEvents = useEventListener(readContracts, "Ballita", "SetCharityPercent", localProvider, 1);
  const [charityPercent, setCharityPercent] = useState(0);
  useEffect(() => {
    const lastCharityPercentEvent = charityPercentEvents&&charityPercentEvents[charityPercentEvents.length - 1];
    const newCharityPercent = lastCharityPercentEvent&&lastCharityPercentEvent.args&&lastCharityPercentEvent.args.newCharityPercent;
    setCharityPercent(newCharityPercent);
  }, [charityPercentEvents]);

  const lastWinningNumberEvents = useEventListener(readContracts, "Ballita", "SetLastWinningNumber", localProvider, 1);
  const [lastWinningNumber, setLastWinningNumber] = useState(0);
  useEffect(() => {
    const lastLastWinningNumberEvent = lastWinningNumberEvents&&lastWinningNumberEvents[lastWinningNumberEvents.length - 1];
    const newLastWinningNumber = lastLastWinningNumberEvent&&lastLastWinningNumberEvent.args&&lastLastWinningNumberEvent.args.newLastWinningNumber;
    setLastWinningNumber(newLastWinningNumber);
  }, [lastWinningNumberEvents]);
  console.log("charity", charityEvents, charity);

  const topNumberFormatted = topNumber&&topNumber.toNumber();
  const lastWinningNumberFormatted = lastWinningNumber&&lastWinningNumber.toNumber();

  const [buying, setBuying] = useState();
  const [pulling, setPulling] = useState();
  const [claiming, setClaiming] = useState();
  const [betNumber, setBetNumber] = useState("1");

  const nextDrawingTime = new Date(currentEpoch*1000);

  const countdown = currentEpoch - timestamp > 0 ? currentEpoch - timestamp : 0;
  const nextDrawing = countdown <= 0 ? "now!" : nextDrawingTime;

  const transferSingleEvents = useEventListener(readContracts, "Ballita", "TransferSingle", localProvider, 1);
  console.log("transferSingleEvents", transferSingleEvents)
  const [yourCollectibles, setYourCollectibles] = useState([]);
  useEffect(() => {
    const updateYourCollectibles = async () => {
      const collectibleUpdate = [];
      const uniqueIdTransfers = [...new Map(transferSingleEvents.map((e) => [e.args.id.toNumber(), e])).values()];

      for (let i = 0; i <uniqueIdTransfers.length; i++) {

        if(uniqueIdTransfers[i].args.to == address){

          const tokenId = uniqueIdTransfers[i].args.id.toNumber();
          const tokenEpoch = tokenId/10000 | 0;

          if(tokenEpoch == currentEpoch) {
            console.log("tokenID", tokenId)
            try {
              const tokenQty = await readContracts.Ballita.balanceOf(address, tokenId);
              const tokenQtyFormatted = tokenQty&&tokenQty.toNumber();
              console.log("GEtting token index", tokenId, tokenQtyFormatted);
              if(tokenQtyFormatted) {
                const tokenURI = await readContracts.Ballita.uri(tokenId);
                const jsonManifestString = atob(tokenURI.substring(29))
                console.log("jsonManifestString", jsonManifestString)
                try {
                  const jsonManifest = JSON.parse(jsonManifestString);
                  if(tokenQtyFormatted) collectibleUpdate.push({id: tokenId, uri: tokenURI, qty: tokenQtyFormatted, epoch: currentEpoch, bet: 1, owner: address, ...jsonManifest })
                } catch (e) {
                  console.log(e);
                }
              }

            } catch (e) {
              console.log(e);
            }
          }
        }
      }
      setYourCollectibles(collectibleUpdate);
    };
    const timeoutId = setTimeout(() => {
      updateYourCollectibles();
    }, 500)

    return () => {
      clearTimeout(timeoutId);
    };

  }, [address, transferSingleEvents, lastWinningNumber]);

  console.log("yourCollectibles", yourCollectibles);
  const [yourWinners, setYourWinners] = useState([]);

  useEffect(() => {

    const updateYourWinners = async () => {
      const winnersUpdate = [];
      let prevEpoch = 69;
      for(let i = 0; i < advanceEvents.length; i++){
        console.log("advanceEvents", advanceEvents);
        try{
          if(advanceEvents[i].args.previousEpoch.toNumber() != prevEpoch){
            prevEpoch = advanceEvents[i].args.previousEpoch.toNumber();
            console.log("prevEpoch", prevEpoch);
            const winningsForEpoch = await readContracts.Ballita.winnings(advanceEvents[i].args.previousEpoch);
            console.log("prevepoch1 winnings", winningsForEpoch)
            if(winningsForEpoch.winningNumber.toNumber()) {
              console.log("prevepoch2 winnings", winningsForEpoch.winningNumber.toNumber())
              const winningIDForEpoch = prevEpoch * 10000 + winningsForEpoch.winningNumber.toNumber();
              const winningsForAddress = await readContracts.Ballita.balanceOf(address, winningIDForEpoch);
              if(winningsForAddress.toNumber()) {
                const tokenURI = await readContracts.Ballita.uri(winningIDForEpoch);
                const jsonManifestString = atob(tokenURI.substring(29))
                try {
                  const jsonManifest = JSON.parse(jsonManifestString);
                  winnersUpdate.push({id: winningIDForEpoch, uri: tokenURI, qty: winningsForAddress.toNumber(), epoch: prevEpoch, number: winningsForEpoch.winningNumber.toNumber(), amount: winningsForEpoch.prize, owner: address, ...jsonManifest })
                } catch (e) {
                  console.log(e);
                }
              }
            }
          }
        }catch (e) {
          console.log(e);
        }
      }
      setYourWinners(winnersUpdate);
    };
    updateYourWinners();
  },[address, claiming, lastWinningNumber]);

  console.log("winners", yourWinners);

  return (
  <div>
        <div id="fixed-game-panel" class="ant-btn ant-btn-round ant-btn-sm">
          <div id="proceeds-benefit">
              {charityPercent&&charityPercent.toNumber()}% of all proceeds benefit &nbsp;<br/><br/>
            {charity?
              <Address
                address={charity}
                ensProvider={mainnetProvider}
                blockExplorer={blockExplorer}
              /> :
              <Spin />
            }
          </div>
          <div id="last-round-winner">
            Winning number from last round: &nbsp;
              <div id="last-round-winner-ball">
                  <div id="last-round-winner-ball-number">
              {lastWinningNumberFormatted ? lastWinningNumberFormatted : <Spin />}
                  </div>
              </div>
          </div>
          <div id="next-drawing">
            A ball can be pulled for this round {nextDrawing.toString()} <br /> (in {countdown} seconds)
          </div>
      </div>
  <div id="scroll" class="container">
    <section id="first-section" class="child">
    <div>
        <div id="layer-intro">
	    </div>

    </div>
    </section>
    <section id="second-section" class="child">
      <div id="place-your-bet">
        <Space>
          Place your bet ( pick a number 1  -{topNumberFormatted})

          <InputNumber
            min={1}
            max={topNumberFormatted}
            placeholder={"number"}
            value={betNumber}
            onChange={setBetNumber}
          />
          <Button
            type="primary"
            disabled={timestamp >= currentEpoch}
            loading={waitingForOracle}
            onClick={async () => {
              setBuying(true);
              await tx(writeContracts.Ballita.mint(betNumber, { value: betPrice }));
              setBuying(false);
            }}
          >
           buy
         </Button>
         for
         <Balance balance={betPrice} provider={localProvider} price={price} />
         each
        </Space>
      </div>
    </section>
    <section id="third-section" class="child">
      <div id="pull-ball">
        <Button
          type="primary"
          disabled={timestamp < currentEpoch}
          loading={pulling}
          onClick={async () => {
            setPulling(true);
            await tx(writeContracts.Ballita.advanceEpoch());
            setPulling(false);

          }}
        >
         pull ball
       </Button>
      </div>
    </section>
      {yourCollectibles.length?
    <section id="fourth-section" class="child">
        <div id="your-open-bets" style={{ width: 620, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
          <h2>your open bets</h2>
          <List
            bordered
            dataSource={yourCollectibles}
            renderItem={item => {
              const id = item.id;
              console.log("owner item", item.owner);
              console.log("IMAGE",item.image)
              return (
                <List.Item key={id + "_" + item.owner}>
                  <Card
                    title={
                      <div>
                        <span style={{ fontSize: 16, marginRight: 8 }}>#{id} qty: {item.qty}</span>
                      </div>
                    }
                  >
                    <a
                      href={`https://${targetNetwork.name == "rinkeby" ? `testnets.` : ""}opensea.io/assets/${
                      readContracts.Ballita.address
                      }/${id}`}
                      target="_blank"
                    >
                    <img src={item.image} />
                    </a>
                    <div>{item.description}</div>

                  </Card>

                  <div>
                    owner:{" "}
                    <Address
                      address={item.owner}
                      ensProvider={mainnetProvider}
                      blockExplorer={blockExplorer}
                      fontSize={16}
                    />
                  </div>
                </List.Item>
              );
            }}
          />
        </div>
    </section>
        : ""
      }
      {yourWinners.length?
    <section id="fifth-section" class="child">
        <div id="your-winners" style={{ width: 620, margin: "auto", marginTop: 32, paddingBottom: 150 }}>
          <h2>your winners</h2>
          <List
            bordered
            dataSource={yourWinners}
            renderItem={item => {
              return (
                <List.Item key={item.id}>
                  <Card
                    title={
                      <div>
                        <span style={{ fontSize: 16, marginRight: 8 }}>#{item.id} qty: {item.qty}</span>
                      </div>
                    }
                  >
                    <a
                      href={`https://${targetNetwork.name == "rinkeby" ? `testnets.` : ""}opensea.io/assets/${
                      readContracts.Ballita.address
                      }/${item.id}`}
                      target="_blank"
                    >
                      <img src={item.image} />
                    </a>
                    <div>{item.description}</div>
                  </Card>
                  <div>
                    for <Balance balance={item.amount} price={price} fontSize={64} /> ea.
                    <br />

                    <Button
                      type="primary"
                      loading={claiming}
                      onClick={async () => {
                        setClaiming(true);
                        await tx(writeContracts.Ballita.claim(item.epoch, item.qty));
                        setClaiming(false);
                      }}
                    >
                     claim
                   </Button>
                  </div>
                </List.Item>
              );
            }}
          />
        </div>
    </section>
        : ""
      }

  </div>
</div>
  );
}

export default Home;
