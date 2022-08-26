pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import 'base64-sol/base64.sol';

import './ToColor.sol';

contract Ballita is ERC1155, Ownable, VRFConsumerBaseV2 {
  VRFCoordinatorV2Interface COORDINATOR;

  using Strings for uint256;
  using ToColor for bytes3;

  event SetPrice(address owner, uint newPrice);
  event SetCharity(address owner, address newCharity);
  event SetCharityPercent(address owner, uint newCharityPercent);
  event SetEpochLength(address owner, uint newEpochLength);
  event SetTopNumber(address owner, uint newTopNumber);
  event SetLastWinningNumber(uint newLastWinningNumber);
  event AdvanceEpoch(address caller, uint previousEpoch, uint newEpoch);

  uint public price;
  address payable public charity;
  uint public charityPercent;
  uint public epochLength;
  uint public currentEpoch;
  uint public previousEpoch;
  uint public topNumber;
  uint public unclaimedPrizes;
  uint public lastWinningNumber;
  uint64 private s_subscriptionId;
  bool public anyLiveBets;
  bool public waitingForOracle;
  string public name;

  // Rinkeby coordinator. For other networks,
  // see https://docs.chain.link/docs/vrf-contracts/#configurations
  address vrfCoordinator = 0x6168499c0cFfCaCD319c818142124B7A15E857ab;

  // The gas lane to use, which specifies the maximum gas price to bump to.
  // For a list of available gas lanes on each network,
  // see https://docs.chain.link/docs/vrf-contracts/#configurations
  bytes32 keyHash = 0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc;

  // Depends on the number of requested values that you want sent to the
  // fulfillRandomWords() function. Storing each word costs about 20,000 gas,
  // so 100,000 is a safe default for this example contract. Test and adjust
  // this limit based on the network that you select, the size of the request,
  // and the processing of the callback request in the fulfillRandomWords()
  // function.
  uint32 public callbackGasLimit = 500000;

  // The default is 3, but you can set this higher.
  uint16 requestConfirmations = 3;

  uint32 numWords =  1;

  uint256 public s_requestId;


  struct Winnings {
    uint winningNumber;
    //uint numberOfWinners;
    uint prize;
  }

  mapping (uint => mapping (uint => uint)) public bets; //epoch=>number=>number of bets
  mapping (uint => Winnings) public winnings;
  mapping (uint256 => bytes3) public color;

  constructor(string memory uri_, uint price_, uint topNumber_, address payable charity_, uint epochLength_, uint charityPercent_, uint64 subscriptionId_, string memory name_) ERC1155(uri_) VRFConsumerBaseV2(vrfCoordinator){
    price = price_;
    charity = charity_;
    charityPercent = charityPercent_;
    epochLength = epochLength_;
    currentEpoch = block.timestamp + epochLength;
    name = name_;
    topNumber = topNumber_;

    COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
    s_subscriptionId = subscriptionId_;

    emit SetPrice(msg.sender, price);
    emit SetCharity(msg.sender, charity);
    emit SetCharityPercent(msg.sender, charityPercent);
    emit SetEpochLength(msg.sender, epochLength);
    emit SetTopNumber(msg.sender, topNumber);
    emit AdvanceEpoch(msg.sender, block.timestamp, currentEpoch);

    // what should we do on deploy?
  }

  function setPrice(uint _newPrice) public onlyOwner {
    price = _newPrice;
    console.log(msg.sender, "set price to ", price);
    emit SetPrice(msg.sender, price);
  }

  function setCharity(address payable _newCharity) public onlyOwner {
    charity = _newCharity;
    console.log(msg.sender, "set charity to ", charity);
    emit SetCharity(msg.sender, charity);
  }

  function setEpochLength(uint _newEpochLength) public onlyOwner {
    epochLength = _newEpochLength;
    console.log(msg.sender, "set epoch length to ", epochLength);
    emit SetEpochLength(msg.sender, epochLength);
  }

  function setTopNumber(uint _newTopNumber) public onlyOwner {
    topNumber = _newTopNumber;
    console.log(msg.sender, "set topNumber to ", topNumber);
    emit SetTopNumber(msg.sender, topNumber);
  }

  function setCharityPercent(uint _newCharityPercent) public onlyOwner {
    require(_newCharityPercent <= 100, "100% max");
    charityPercent = _newCharityPercent;
    console.log(msg.sender, "set charity % to ", charityPercent);
    emit SetCharityPercent(msg.sender, charityPercent);
  }

  function setCallbackGasLimit(uint32 _newLimit) public onlyOwner {
    callbackGasLimit = _newLimit;
    console.log(msg.sender, "set callback limit to ", callbackGasLimit);
  }

  // Assumes the subscription is funded sufficiently.
  function _requestRandomWords() internal {
    // Will revert if subscription is not set and funded.
    s_requestId = COORDINATOR.requestRandomWords(
      keyHash,
      s_subscriptionId,
      requestConfirmations,
      callbackGasLimit,
      numWords
    );
  }

  function aaadvance() public {
    require(waitingForOracle, "pullball first");
    bytes32 predictableRandom = keccak256(abi.encodePacked( block.timestamp ));
    lastWinningNumber = uint256(predictableRandom) % topNumber +1;
    Winnings storage w = winnings[previousEpoch];
    w.winningNumber = lastWinningNumber;
    uint numberOfWinners = bets[previousEpoch][w.winningNumber];
    if(numberOfWinners != 0){
      uint pot = address(this).balance - unclaimedPrizes;
      uint charityPayment = ((pot * charityPercent) / 100);
      pot = pot - charityPayment;
      w.prize = (pot / numberOfWinners) - 1; //the -1 is for rounding errors
      unclaimedPrizes += pot;
      //charity only gets paid if there is a winner
      charity.transfer(charityPayment);
    }
    waitingForOracle = false;
    emit SetLastWinningNumber(lastWinningNumber);
  }

  function fulfillRandomWords(
    uint256, // requestId
    uint256[] memory randomWords
  ) internal override {
    lastWinningNumber = randomWords[0] % topNumber +1;
    Winnings storage w = winnings[previousEpoch];
    w.winningNumber = lastWinningNumber;
    uint numberOfWinners = bets[previousEpoch][w.winningNumber];
    if(numberOfWinners != 0){
      uint pot = address(this).balance - unclaimedPrizes;
      uint charityPayment = ((pot * charityPercent) / 100);
      pot = pot - charityPayment;
      w.prize = (pot / numberOfWinners) - 1; //the -1 is for rounding errors
      unclaimedPrizes += pot;
      //charity only gets paid if there is a winner
      charity.transfer(charityPayment);
    }
    waitingForOracle = false;
    emit SetLastWinningNumber(lastWinningNumber);
  }


  function advanceEpoch() public {
    require(block.timestamp > currentEpoch, "epoch not finished");
    require(!waitingForOracle, "waiting for oracle");
    if(anyLiveBets) {
      //_requestRandomWords();
      previousEpoch = currentEpoch;
      anyLiveBets = false;
      lastWinningNumber = 0;
      waitingForOracle = true;
    }
    currentEpoch = block.timestamp + epochLength;
    emit AdvanceEpoch(msg.sender, previousEpoch, currentEpoch);
  }

  //having difficulty with "stuck" oracle requests - hopfully this is not needed in production version

  function reroll() public onlyOwner {
    require(waitingForOracle && block.timestamp > currentEpoch, "no cheating");
    _requestRandomWords();
  }


  function mint(uint _betNumber) public payable returns (uint){
    require(msg.value >= price, "not enough funds");
    require(block.timestamp < currentEpoch, "advance epoch to enable");
    require(_betNumber <= topNumber && _betNumber > 0, "bet number out of range");
    require(!waitingForOracle);
    bets[currentEpoch][_betNumber]++;
    uint id = currentEpoch * 10000 + _betNumber;
    uint amount = msg.value/price;
    _mint(msg.sender, id, amount, msg.data);
    anyLiveBets = true;

    if(color[currentEpoch] == 0){
      bytes32 predictableRandom = keccak256(abi.encodePacked( currentEpoch ));
      color[currentEpoch] = bytes2(predictableRandom[0]) | ( bytes2(predictableRandom[1]) >> 8 ) | ( bytes3(predictableRandom[2]) >> 16 );
    }

    return id;
  }

  function parseId(uint id) public pure returns (uint, uint) {
    uint epochFromId = id / 10000;
    uint numberFromId = id - (epochFromId * 10000);
    return (epochFromId, numberFromId);
  }

  function uri(uint256 id) public view override returns (string memory) {
      (uint epochFromId, uint numberFromId) = parseId(id);
      console.log("token info", id, epochFromId, numberFromId);
      require(bets[epochFromId][numberFromId] > 0, "not exist");
      string memory ballName = string(abi.encodePacked('Ball #',id.toString()));
      string memory description = string(abi.encodePacked('Background color #',color[epochFromId].toColor(),''));
      string memory image = Base64.encode(bytes(generateSVGofTokenById(id)));

      return
          string(
              abi.encodePacked(
                'data:application/json;base64,',
                Base64.encode(
                    bytes(
                          abi.encodePacked(
                              '{"name":"',
                              ballName,
                              '", "description":"',
                              description,
                              '", "external_url":"https://bolita_rinkeby.0xwildhare.com/token/',
                              id.toString(),
                              '", "attributes": [{"trait_type": "background_color", "value": "#',
                              color[epochFromId].toColor(),
                              '"},{"trait_type": "number", "value": ',
                              uint2str(numberFromId),
                              '}], "image": "',
                              'data:image/svg+xml;base64,',
                              image,
                              '"}'
                          )
                        )
                    )
              )
          );
  }

  function generateSVGofTokenById(uint256 id) internal view returns (string memory) {

    string memory svg = string(abi.encodePacked(
      '<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">',
        renderTokenById(id),
      '</svg>'
    ));

    return svg;
  }

string private middlePart = ';stop-opacity:0"/></radialGradient><ellipse id="svg_5" style="fill:url(#sssvg2);" cx="225.7" cy="301.1" rx="139.4" ry="7.8"/><radialGradient id="svg_3" cx="200" cy="440" r="149.26" fx="200" fy="326.22" gradientTransform="matrix(1 0 0 1 0 -240)" gradientUnits="userSpaceOnUse"><stop  offset="0.64" style="stop-color:#FFFFF0"/><stop  offset="0.67" style="stop-color:#FBFBEC"/><stop  offset="0.7" style="stop-color:#EEEEE0"/><stop  offset="0.73" style="stop-color:#D9D9CC"/><stop  offset="0.77" style="stop-color:#BCBCB1"/><stop  offset="0.8" style="stop-color:#97978E"/><stop  offset="0.82" style="stop-color:#808079"/></radialGradient><circle id="svg_52" style="fill:url(#svg_3);" cx="200" cy="200" r="100"/><circle id="svg_53" fill="#';

  // Visibility is `public` to enable it being called by other contracts for composition.
  function renderTokenById(uint256 id) public view returns (string memory) {
    (uint epochFromId, uint numberFromId) = parseId(id);

    string memory dotColor = "D2042D";
    if(winnings[epochFromId].winningNumber == numberFromId) dotColor = "2E8B57";
    string memory render = string(abi.encodePacked(
      '<g id="ball">',
      '<rect width="400" height="400" id="svg_1" fill="#',
      color[epochFromId].toColor(),
      '" stroke-width="3" stroke="#000"/>',
      '<radialGradient id="sssvg2" cx="220" cy="4154.0601" r="125" gradientTransform="matrix(0.99 0 0 8.000000e-02 0.52 -35.11)" gradientUnits="userSpaceOnUse"><stop  offset="0.41" style="stop-color:#000000"/><stop  offset="1" style="stop-color:#',
      color[epochFromId].toColor(),
      middlePart,
      dotColor,
      '" cx="200" cy="200" r="50"/>',
      '<text text-anchor="middle" x="200" y="218" fill="#ffffff" stroke="#000" stroke-width="1" font-weight="bold" font-family="Helvetica-Bold" font-size="60" >',
      numberFromId.toString(),
      '</text>',
      '</g>'
      ));

    return render;
  }

  function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
      if (_i == 0) {
          return "0";
      }
      uint j = _i;
      uint len;
      while (j != 0) {
          len++;
          j /= 10;
      }
      bytes memory bstr = new bytes(len);
      uint k = len;
      while (_i != 0) {
          k = k-1;
          uint8 temp = (48 + uint8(_i - _i / 10 * 10));
          bytes1 b1 = bytes1(temp);
          bstr[k] = b1;
          _i /= 10;
      }
      return string(bstr);
  }

  function claim(uint _epoch, uint _qty) public {
    uint winningTicket = (_epoch * 10000) + winnings[_epoch].winningNumber;
    require(balanceOf(msg.sender, winningTicket) >= _qty, "dont have the tickets");
    _burn(msg.sender, winningTicket, _qty);
    uint claimAmount = winnings[_epoch].prize * _qty;
    unclaimedPrizes -= claimAmount;
    payable(msg.sender).transfer(claimAmount);
  }

  // to support receiving ETH by default
  receive() external payable {}
  fallback() external payable {}
}
