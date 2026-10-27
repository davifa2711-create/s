# Assistente para os escritórios atendidos

Um agente em Python, que usa a IA do Claude, para quem presta serviço a vários
escritórios de advocacia e se comunica pelo WhatsApp no Rambox. Ele ajuda com:

- relatórios diários de pendências e retornos por cliente;
- avisos de audiência e de perícia para enviar ao cliente pelo WhatsApp;
- resumos de publicações e intimações (PJe, DJEN, Astrea);
- uma lista de pendências ("anota", "lista", "feito:"), separada por escritório.

## Vários escritórios

Ao abrir, o agente pergunta qual escritório você vai atender (ou cadastra um novo).
Cada escritório tem a sua pasta em `escritorios/<nome>/` com:

- `instrucoes.md`: nome, advogadas, tom com os clientes, assinatura etc. (preencha uma vez);
- `pendencias.json`: as pendências só daquele escritório;
- `saidas/`: os textos salvos.

Para trocar de escritório, digite `sair` e abra de novo. A pasta `escritorios/` não vai
para o GitHub: os dados dos clientes ficam só no seu computador.

## WhatsApp pelo Rambox

O agente não envia mensagens sozinho. Ele escreve o texto e, quando você pedir
("copia"), coloca a mensagem na área de transferência. Aí é só colar (Ctrl+V)
na conversa do Rambox e conferir antes de enviar.

## Como instalar (uma vez só)

1. Instale o Python 3.10 ou mais novo: https://www.python.org/downloads/
2. Crie uma chave da API em https://console.anthropic.com/ (menu *API Keys*).
   O uso da API é cobrado à parte, pelo consumo.
3. No terminal, dentro desta pasta:

```bash
pip install -r requirements.txt
```

## Como usar

```bash
# Mac/Linux
export ANTHROPIC_API_KEY="sua-chave"
# Windows (PowerShell)
$env:ANTHROPIC_API_KEY="sua-chave"

python agente.py
```

Exemplos do que digitar:

- `anota: cliente Maria Souza, juntar laudo médico até 30/10`
- `quais as pendências da Maria?`
- `feito: laudo da Maria`
- `faz o aviso de perícia do João Lima, dia 05/11 às 9h, INSS de Campinas, perito Dr. Carlos`
- Para colar uma publicação inteira: digite `.`, cole o texto, e termine com outra linha só com `.`

Os textos que você pedir para salvar vão para a pasta `saidas/` do escritório.

## Como personalizar

- Regras que valem para todos os escritórios: `instrucoes.md`.
- Dados e jeito de cada escritório: `escritorios/<nome>/instrucoes.md`
  (é criado a partir de `modelo-escritorio.md`).

Tudo em português comum, sem precisar mexer no código.

## Cuidados

- O agente não inventa datas nem dados; quando falta algo ele pergunta ou marca `[PREENCHER]`.
  Mesmo assim, confira prazos e dados antes de enviar.
- Os textos que você digita são enviados para a API da Anthropic. Evite colar dados
  sensíveis que não sejam necessários para a tarefa.
