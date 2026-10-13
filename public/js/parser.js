'use strict';

const variables = new Map();
const operators = {
  '+': { precedence: 1, associativity: 'left', arity: 2 },
  '-': { precedence: 1, associativity: 'left', arity: 2 },
  '*': { precedence: 2, associativity: 'left', arity: 2 },
  '/': { precedence: 2, associativity: 'left', arity: 2 },
  '^': { precedence: 4, associativity: 'right', arity: 2 },
  'u+': { precedence: 3, associativity: 'right', arity: 1 },
  'u-': { precedence: 3, associativity: 'right', arity: 1 }
};

function tokenize(source) {
  const tokens = [];
  let position = 0;

  while (position < source.length) {
    if (/\s/.test(source[position])) {
      position += 1;
      continue;
    }

    const remaining = source.slice(position);
    const number = remaining.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    const identifier = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);

    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value)) {
        throw new Error('El número está fuera del rango permitido.');
      }
      tokens.push({ type: 'number', value: number[0] });
      position += number[0].length;
    } else if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0] });
      position += identifier[0].length;
    } else if ('+-−*/×÷^()='.includes(source[position])) {
      const symbol = { '−': '-', '×': '*', '÷': '/' }[source[position]] || source[position];
      tokens.push({ type: symbol, value: symbol });
      position += 1;
    } else {
      throw new Error(`Carácter no válido: "${source[position]}".`);
    }
  }

  if (tokens.length === 0) {
    throw new Error('Escribe una expresión antes de calcular.');
  }
  return tokens;
}

function parseInput(source) {
  const tokens = tokenize(source);
  let target = null;

  if (tokens[0].type === 'identifier' && tokens[1]?.type === '=') {
    target = tokens[0].value;
    if (new Set([
      'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
      'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for',
      'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'return',
      'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while',
      'with', 'yield', 'enum', 'implements', 'interface', 'package', 'private',
      'protected', 'public', 'static'
    ]).has(target)) {
      throw new Error(`"${target}" es una palabra reservada y no se puede usar como variable.`);
    }
    tokens.splice(0, 2);
    if (tokens.length === 0) {
      throw new Error('Escribe una expresión después del signo =.');
    }
  } else if (tokens.some(token => token.type === '=')) {
    throw new Error('La asignación debe tener el formato nombre = expresión.');
  }

  const postfix = [];
  const stack = [];
  let expectsOperand = true;

  for (const token of tokens) {
    if (token.type === 'number' || token.type === 'identifier') {
      if (!expectsOperand) {
        throw new Error('Falta un operador entre los valores.');
      }
      postfix.push(token);
      expectsOperand = false;
      continue;
    }

    if (token.type === '(') {
      if (!expectsOperand) {
        throw new Error('Falta un operador antes del paréntesis.');
      }
      stack.push(token);
      expectsOperand = true;
      continue;
    }

    if (token.type === ')') {
      if (expectsOperand) {
        throw new Error('El paréntesis está vacío o falta un valor.');
      }
      while (stack.length > 0 && stack[stack.length - 1].type !== '(') {
        postfix.push(stack.pop());
      }
      if (stack.length === 0) {
        throw new Error('Hay un paréntesis de cierre sin pareja.');
      }
      stack.pop();
      expectsOperand = false;
      continue;
    }

    const symbol = expectsOperand ? `u${token.value}` : token.value;
    const current = operators[symbol];
    if (!current) {
      throw new Error('La expresión contiene un operador no válido.');
    }

    if (!expectsOperand) {
      while (stack.length > 0 && operators[stack[stack.length - 1].type]) {
        const previous = operators[stack[stack.length - 1].type];
        const shouldPop = current.associativity === 'left'
          ? current.precedence <= previous.precedence
          : current.precedence < previous.precedence;
        if (!shouldPop) break;
        postfix.push(stack.pop());
      }
    }

    stack.push({ type: symbol, value: symbol });
    expectsOperand = true;
  }

  if (expectsOperand) {
    throw new Error('La expresión termina con un operador o está incompleta.');
  }

  while (stack.length > 0) {
    const operator = stack.pop();
    if (operator.type === '(') {
      throw new Error('Hay un paréntesis de apertura sin pareja.');
    }
    postfix.push(operator);
  }

  return { postfix, target };
}

function formatNumber(value) {
  return String(Number(value.toPrecision(12)));
}

function calculate(postfix, target) {
  const values = [];
  const steps = [];
  const quadruples = [];
  const triples = [];
  let temporary = 0;
  const usedNames = new Set([
    ...postfix.filter(token => token.type === 'identifier').map(token => token.value),
    ...variables.keys(),
    target
  ]);
  const initialVariables = [...new Set(
    postfix
      .filter(token => token.type === 'identifier' && variables.has(token.value))
      .map(token => token.value)
  )].map(name => [name, String(variables.get(name))]);
  const nextTemporary = () => {
    let name;
    do {
      name = `_tmp${++temporary}`;
    } while (usedNames.has(name));
    usedNames.add(name);
    return name;
  };

  for (const token of postfix) {
    if (token.type === 'number') {
      values.push({ value: Number(token.value), operand: token.value });
      continue;
    }

    if (token.type === 'identifier') {
      if (!variables.has(token.value)) {
        throw new Error(`La variable "${token.value}" no tiene un valor asignado.`);
      }
      values.push({ value: variables.get(token.value), operand: token.value });
      continue;
    }

    const operator = operators[token.type];
    if (!operator || values.length < operator.arity) {
      throw new Error('La expresión no se pudo resolver. Revisa los operadores y valores.');
    }

    if (operator.arity === 1) {
      const operand = values.pop();
      const value = token.type === 'u-' ? -operand.value : operand.value;
      if (!Number.isFinite(value)) {
        throw new Error('El resultado no es un número finito.');
      }
      const name = nextTemporary();
      const symbol = token.type === 'u-' ? '-' : '+';
      values.push({ value, operand: name });
      quadruples.push({ op: symbol, op1: operand.operand, op2: '—', res: name });
      triples.push({ op: symbol, op1: operand.operand, op2: '—' });
      steps.push(`${name} = ${symbol}${operand.operand} = ${formatNumber(value)}`);
      continue;
    }

    const right = values.pop();
    const left = values.pop();
    let value;

    switch (token.type) {
      case '+': value = left.value + right.value; break;
      case '-': value = left.value - right.value; break;
      case '*': value = left.value * right.value; break;
      case '/':
        if (right.value === 0) {
          throw new Error('No se puede dividir entre cero.');
        }
        value = left.value / right.value;
        break;
      case '^': value = left.value ** right.value; break;
      default: throw new Error('La expresión contiene un operador no válido.');
    }

    if (!Number.isFinite(value)) {
      throw new Error('El resultado no es un número finito.');
    }

    const name = nextTemporary();
    values.push({ value, operand: name });
    quadruples.push({ op: token.type, op1: left.operand, op2: right.operand, res: name });
    triples.push({ op: token.type, op1: left.operand, op2: right.operand });
    steps.push(`${name} = ${left.operand} ${token.type} ${right.operand} = ${formatNumber(value)}`);
  }

  if (values.length !== 1) {
    throw new Error('La expresión está incompleta o no es válida.');
  }

  const result = values[0].value;
  if (target) {
    variables.set(target, result);
    quadruples.push({ op: '=', op1: values[0].operand, op2: '—', res: target });
    triples.push({ op: '=', op1: values[0].operand, op2: '—' });
    steps.push(`${target} = ${values[0].operand} = ${formatNumber(result)} (variable guardada)`);
  } else if (steps.length === 0) {
    steps.push(`La expresión contiene un único valor: ${formatNumber(result)}.`);
  }

  return {
    target,
    result: formatNumber(result),
    initialVariables,
    steps,
    quadruples,
    triples
  };
}

function clearVariables() {
  variables.clear();
}
