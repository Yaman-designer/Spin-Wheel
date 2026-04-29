function flipCoin() {
  const result = Math.random() > 0.5 ? "🎉 You Win!" : "😢 Try Again";
  document.getElementById("coin-result").innerText = result;
}