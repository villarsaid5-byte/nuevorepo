function renderTable(selector, rows, columns) {
  const body = document.querySelector(`${selector} tbody`);
  body.replaceChildren();

  rows.forEach((item, index) => {
    const row = document.createElement('tr');

    [index + 1, ...columns.map(column => item[column])].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });

    body.appendChild(row);
  });
}

function render(result) {
  document.getElementById('resultado').textContent =
    result.target ? `${result.target} = ${result.result}` : result.result;

  const list = document.getElementById('lista-pasos');
  list.replaceChildren();

  result.steps.forEach((step, index) => {
    const item = document.createElement('li');
    const number = document.createElement('span');
    const text = document.createElement('span');

    number.className = 'step-number';
    number.textContent = index + 1;
    text.textContent = step;
    item.append(number, text);
    list.appendChild(item);
  });

  renderTable('#tabla-cuadruplos', result.quadruples, ['op', 'op1', 'op2', 'res']);
  renderTable('#tabla-triplos', result.triples, ['op', 'op1', 'op2']);

  const initializedVariables = new Set(result.initialVariables.map(([name]) => name));
  const declarations = result.initialVariables.map(([name, value]) => `const ${name} = ${value};`);
  const code = result.quadruples.map(item => {
    if (item.op === '=') {
      const declaration = initializedVariables.has(item.res) ? '' : 'let ';
      return `${declaration}${item.res} = ${item.op1};`;
    }
    return item.op2 === '—'
      ? `let ${item.res} = ${item.op}${item.op1};`
      : `let ${item.res} = ${item.op1} ${item.op === '^' ? '**' : item.op} ${item.op2};`;
  });

  document.getElementById('codigo-js').textContent =
    [...declarations, ...code].join('\n');
  document.getElementById('alerta').hidden = true;
  document.getElementById('resultado-panel').classList.add('has-result');
}

function clearResults() {
  document.getElementById('resultado').textContent = '—';
  document.getElementById('lista-pasos').innerHTML =
    '<li class="empty-state">Los pasos aparecerán aquí al calcular.</li>';

  document.querySelector('#tabla-cuadruplos tbody').replaceChildren();
  document.querySelector('#tabla-triplos tbody').replaceChildren();
  document.getElementById('codigo-js').textContent =
    'El código aparecerá aquí al calcular.';
  document.getElementById('alerta').hidden = true;
  document.getElementById('resultado-panel').classList.remove('has-result');
}

const form = document.getElementById('formulario');
const input = document.getElementById('expresion');

form.addEventListener('submit', event => {
  event.preventDefault();

  try {
    const parsed = parseInput(input.value);
    render(calculate(parsed.postfix, parsed.target));
  } catch (error) {
    clearResults();
    document.getElementById('alerta').textContent = error.message;
    document.getElementById('alerta').hidden = false;
  }
});

document.getElementById('limpiar').addEventListener('click', () => {
  input.value = '';
  clearVariables();
  clearResults();
  input.focus();
});

input.addEventListener('input', () => {
  document.getElementById('alerta').hidden = true;
});
