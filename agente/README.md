# Assistente interno do escritório

Um agente em Python, que usa a IA do Claude, para ajudar a equipe com:

- relatórios diários de pendências e retornos por cliente;
- avisos de audiência e de perícia para enviar ao cliente pelo WhatsApp;
- resumos de publicações e intimações (PJe, DJEN, Astrea);
- uma lista de pendências ("anota", "lista", "feito:"), guardada em `pendencias.json`.

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

Os textos que você pedir para salvar vão para a pasta `saidas/`.

## Como personalizar

O comportamento do agente está em `instrucoes.md`, em português comum.
Edite esse arquivo para mudar o tom, incluir o nome do escritório, as advogadas,
modelos de mensagem, etc. Não precisa mexer no código.

## Cuidados

- O agente não inventa datas nem dados; quando falta algo ele pergunta ou marca `[PREENCHER]`.
  Mesmo assim, confira prazos e dados antes de enviar.
- Os textos que você digita são enviados para a API da Anthropic. Evite colar dados
  sensíveis que não sejam necessários para a tarefa.
