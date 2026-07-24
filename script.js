const expressionEl = document.getElementById('expression');
const resultEl = document.getElementById('result');

let firstOperand = null;
let operator = null;
let currentInput = '0';
let waitingForSecondOperand = false;

const OPERATOR_SYMBOLS = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
};

function updateDisplay() {
  resultEl.textContent = currentInput;
  if (operator && firstOperand !== null) {
    expressionEl.textContent = `${formatNumber(firstOperand)} ${OPERATOR_SYMBOLS[operator]}`;
  } else {
    expressionEl.textContent = '';
  }
}

function formatNumber(value) {
  return Number(value.toPrecision(12)).toString();
}

function inputDigit(digit) {
  if (waitingForSecondOperand) {
    currentInput = digit;
    waitingForSecondOperand = false;
  } else {
    currentInput = currentInput === '0' ? digit : currentInput + digit;
  }
}

function inputDecimal() {
  if (waitingForSecondOperand) {
    currentInput = '0.';
    waitingForSecondOperand = false;
    return;
  }
  if (!currentInput.includes('.')) {
    currentInput += '.';
  }
}

function clearAll() {
  firstOperand = null;
  operator = null;
  currentInput = '0';
  waitingForSecondOperand = false;
}

function deleteLast() {
  if (waitingForSecondOperand) return;
  currentInput = currentInput.length > 1 ? currentInput.slice(0, -1) : '0';
}

function toggleSign() {
  currentInput = currentInput.startsWith('-') ? currentInput.slice(1) : '-' + currentInput;
}

function inputPercent() {
  currentInput = formatNumber(parseFloat(currentInput) / 100);
}

function compute(a, b, op) {
  switch (op) {
    case 'add':
      return a + b;
    case 'subtract':
      return a - b;
    case 'multiply':
      return a * b;
    case 'divide':
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

function handleOperator(nextOperator) {
  const inputValue = parseFloat(currentInput);

  if (operator && waitingForSecondOperand) {
    operator = nextOperator;
    return;
  }

  if (firstOperand === null) {
    firstOperand = inputValue;
  } else if (operator) {
    const result = compute(firstOperand, inputValue, operator);
    if (Number.isNaN(result)) {
      currentInput = 'Erro';
      firstOperand = null;
      operator = null;
      waitingForSecondOperand = false;
      updateDisplay();
      return;
    }
    firstOperand = result;
    currentInput = formatNumber(result);
  }

  waitingForSecondOperand = true;
  operator = nextOperator;
}

function handleEquals() {
  if (operator === null || waitingForSecondOperand) return;
  const inputValue = parseFloat(currentInput);
  const result = compute(firstOperand, inputValue, operator);
  currentInput = Number.isNaN(result) ? 'Erro' : formatNumber(result);
  firstOperand = null;
  operator = null;
  waitingForSecondOperand = false;
}

document.querySelector('.buttons').addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;

  const { value, action } = target.dataset;

  if (value !== undefined) {
    if (value === '.') {
      inputDecimal();
    } else {
      inputDigit(value);
    }
    updateDisplay();
    return;
  }

  switch (action) {
    case 'clear':
      clearAll();
      break;
    case 'delete':
      deleteLast();
      break;
    case 'percent':
      inputPercent();
      break;
    case 'equals':
      handleEquals();
      break;
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
      handleOperator(action);
      break;
  }
  updateDisplay();
});

document.addEventListener('keydown', (event) => {
  const { key } = event;
  if (/^[0-9]$/.test(key)) {
    inputDigit(key);
  } else if (key === '.') {
    inputDecimal();
  } else if (key === '+') {
    handleOperator('add');
  } else if (key === '-') {
    handleOperator('subtract');
  } else if (key === '*') {
    handleOperator('multiply');
  } else if (key === '/') {
    event.preventDefault();
    handleOperator('divide');
  } else if (key === 'Enter' || key === '=') {
    handleEquals();
  } else if (key === 'Backspace') {
    deleteLast();
  } else if (key === 'Escape') {
    clearAll();
  } else if (key === '%') {
    inputPercent();
  } else {
    return;
  }
  updateDisplay();
});

updateDisplay();
