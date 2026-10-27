"""Assistente interno para os escritórios atendidos, feito com a API do Claude.

Uso:
    export ANTHROPIC_API_KEY="sua-chave"
    python agente.py
"""

import json
import re
import uuid
from datetime import date
from pathlib import Path

import anthropic

try:
    import pyperclip
except ImportError:
    pyperclip = None

PASTA = Path(__file__).parent
PASTA_ESCRITORIOS = PASTA / "escritorios"
# Cada escritório tem sua pasta, com instrucoes.md, pendencias.json e saidas/.
# Estes caminhos são definidos em escolher_escritorio().
ARQUIVO_PENDENCIAS = Path()
PASTA_SAIDAS = Path()
MODELO = "claude-opus-5-5"

DIAS_SEMANA = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira",
               "sexta-feira", "sábado", "domingo"]


# ---------- Ferramentas que o agente pode usar ----------

def _ler_pendencias() -> list[dict]:
    if not ARQUIVO_PENDENCIAS.exists():
        return []
    return json.loads(ARQUIVO_PENDENCIAS.read_text(encoding="utf-8"))


def _gravar_pendencias(pendencias: list[dict]) -> None:
    ARQUIVO_PENDENCIAS.write_text(
        json.dumps(pendencias, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def data_de_hoje() -> str:
    hoje = date.today()
    return f"{hoje.strftime('%d/%m/%Y')} ({DIAS_SEMANA[hoje.weekday()]})"


def registrar_pendencia(cliente: str, descricao: str, prazo: str = "") -> str:
    pendencias = _ler_pendencias()
    nova = {
        "id": uuid.uuid4().hex[:6],
        "cliente": cliente,
        "descricao": descricao,
        "prazo": prazo,
        "criada_em": date.today().isoformat(),
        "concluida": False,
    }
    pendencias.append(nova)
    _gravar_pendencias(pendencias)
    return f"Pendência registrada com id {nova['id']}."


def listar_pendencias(cliente: str = "", incluir_concluidas: bool = False) -> str:
    resultado = [
        p for p in _ler_pendencias()
        if (incluir_concluidas or not p["concluida"])
        and (not cliente or cliente.lower() in p["cliente"].lower())
    ]
    if not resultado:
        return "Nenhuma pendência encontrada."
    return json.dumps(resultado, ensure_ascii=False, indent=2)


def concluir_pendencia(id: str) -> str:
    pendencias = _ler_pendencias()
    for p in pendencias:
        if p["id"] == id:
            p["concluida"] = True
            p["concluida_em"] = date.today().isoformat()
            _gravar_pendencias(pendencias)
            return f"Pendência {id} marcada como concluída."
    raise ValueError(f"Não existe pendência com id {id}.")


def salvar_documento(nome_arquivo: str, conteudo: str) -> str:
    # Só o nome do arquivo, sem pastas, para não gravar fora de saidas/
    nome = re.sub(r"[^\w\-. ]", "_", Path(nome_arquivo).name).strip() or "documento"
    if not nome.endswith((".txt", ".md")):
        nome += ".txt"
    PASTA_SAIDAS.mkdir(exist_ok=True)
    caminho = PASTA_SAIDAS / nome
    caminho.write_text(conteudo, encoding="utf-8")
    return f"Salvo em {caminho}"


def copiar_mensagem(texto: str) -> str:
    if pyperclip is None:
        raise RuntimeError("pyperclip não instalado; rode: pip install -r requirements.txt")
    pyperclip.copy(texto)
    return "Mensagem copiada. É só colar (Ctrl+V) na conversa do Rambox."


FUNCOES = {
    "copiar_mensagem": copiar_mensagem,
    "data_de_hoje": data_de_hoje,
    "registrar_pendencia": registrar_pendencia,
    "listar_pendencias": listar_pendencias,
    "concluir_pendencia": concluir_pendencia,
    "salvar_documento": salvar_documento,
}


def _esquema(propriedades: dict, obrigatorios: list[str]) -> dict:
    return {
        "type": "object",
        "properties": propriedades,
        "required": obrigatorios,
        "additionalProperties": False,
    }


TEXTO = {"type": "string"}

FERRAMENTAS = [
    {
        "name": "copiar_mensagem",
        "description": "Copia uma mensagem pronta para a área de transferência, para a funcionária colar no WhatsApp pelo Rambox. Passe só o texto da mensagem, sem comentários.",
        "input_schema": _esquema({"texto": {**TEXTO, "description": "Texto exato da mensagem."}}, ["texto"]),
    },
    {
        "name": "data_de_hoje",
        "description": "Retorna a data de hoje e o dia da semana. Use antes de calcular prazos ou datas relativas.",
        "input_schema": _esquema({}, []),
    },
    {
        "name": "registrar_pendencia",
        "description": "Registra uma nova pendência de um cliente na lista do escritório.",
        "input_schema": _esquema(
            {
                "cliente": {**TEXTO, "description": "Nome do cliente."},
                "descricao": {**TEXTO, "description": "O que precisa ser feito."},
                "prazo": {**TEXTO, "description": "Prazo no formato DD/MM/AAAA, ou vazio se não houver."},
            },
            ["cliente", "descricao", "prazo"],
        ),
    },
    {
        "name": "listar_pendencias",
        "description": "Lista as pendências registradas, opcionalmente filtrando por cliente.",
        "input_schema": _esquema(
            {
                "cliente": {**TEXTO, "description": "Parte do nome do cliente, ou vazio para todos."},
                "incluir_concluidas": {"type": "boolean", "description": "Se deve incluir as já concluídas."},
            },
            ["cliente", "incluir_concluidas"],
        ),
    },
    {
        "name": "concluir_pendencia",
        "description": "Marca uma pendência como concluída, pelo id mostrado em listar_pendencias.",
        "input_schema": _esquema({"id": {**TEXTO, "description": "Id da pendência."}}, ["id"]),
    },
    {
        "name": "salvar_documento",
        "description": "Salva um texto pronto (relatório, aviso, resumo) num arquivo na pasta saidas/.",
        "input_schema": _esquema(
            {
                "nome_arquivo": {**TEXTO, "description": "Nome do arquivo, ex.: relatorio-27-10.txt"},
                "conteudo": {**TEXTO, "description": "Texto completo a salvar."},
            },
            ["nome_arquivo", "conteudo"],
        ),
    },
]
for ferramenta in FERRAMENTAS:
    ferramenta["strict"] = True


def executar_ferramenta(nome: str, entrada: dict) -> dict:
    try:
        return {"content": FUNCOES[nome](**entrada)}
    except Exception as erro:
        return {"content": f"Erro: {erro}", "is_error": True}


# ---------- Conversa ----------

def responder(client: anthropic.Anthropic, sistema: str, mensagens: list) -> str:
    """Roda o ciclo do agente até ele terminar de usar ferramentas."""
    while True:
        resposta = client.beta.messages.create(
            model=MODELO,
            max_tokens=16000,
            system=sistema,
            tools=FERRAMENTAS,
            output_config={"effort": "medium"},
            # Se o modelo recusar por engano, a API tenta de novo em outro modelo
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            cache_control={"type": "ephemeral"},
            messages=mensagens,
        )
        # Guarda a resposta inteira (não só o texto) para manter o histórico válido
        mensagens.append({"role": "assistant", "content": resposta.content})

        if resposta.stop_reason == "refusal":
            return "(O assistente não pôde atender esse pedido. Tente reformular.)"
        if resposta.stop_reason == "pause_turn":
            continue
        if resposta.stop_reason != "tool_use":
            return "\n".join(b.text for b in resposta.content if b.type == "text")

        resultados = []
        for bloco in resposta.content:
            if bloco.type == "tool_use":
                print(f"  [usando {bloco.name}]")
                resultados.append({
                    "type": "tool_result",
                    "tool_use_id": bloco.id,
                    **executar_ferramenta(bloco.name, bloco.input),
                })
        mensagens.append({"role": "user", "content": resultados})


def escolher_escritorio() -> str:
    """Pergunta qual escritório atender e devolve as instruções dele."""
    global ARQUIVO_PENDENCIAS, PASTA_SAIDAS
    PASTA_ESCRITORIOS.mkdir(exist_ok=True)
    escritorios = sorted(p for p in PASTA_ESCRITORIOS.iterdir() if p.is_dir())

    print("Qual escritório você vai atender agora?")
    for numero, pasta in enumerate(escritorios, 1):
        print(f"  {numero}. {pasta.name}")
    print("  N. Cadastrar um novo escritório")

    while True:
        escolha = input("Escolha: ").strip()
        if escolha.isdigit() and 1 <= int(escolha) <= len(escritorios):
            pasta = escritorios[int(escolha) - 1]
            break
        if escolha.lower() == "n":
            nome = re.sub(r"[^\w\- ]", "", input("Nome do escritório: ")).strip()
            if not nome:
                continue
            pasta = PASTA_ESCRITORIOS / nome
            pasta.mkdir(exist_ok=True)
            modelo = (PASTA / "modelo-escritorio.md").read_text(encoding="utf-8")
            (pasta / "instrucoes.md").write_text(modelo.replace("[NOME DO ESCRITÓRIO]", nome), encoding="utf-8")
            print(f"Criado. Depois preencha {pasta / 'instrucoes.md'} com os dados do escritório.")
            break

    ARQUIVO_PENDENCIAS = pasta / "pendencias.json"
    PASTA_SAIDAS = pasta / "saidas"
    especificas = (pasta / "instrucoes.md").read_text(encoding="utf-8")
    return f"Escritório atendido nesta conversa: {pasta.name}\n\n{especificas}"


def main() -> None:
    client = anthropic.Anthropic()
    gerais = (PASTA / "instrucoes.md").read_text(encoding="utf-8")
    sistema = f"{gerais}\n\n---\n\n{escolher_escritorio()}"
    mensagens: list = []

    print("\nPode falar. Digite sua mensagem (ou 'sair'; para trocar de escritório, saia e abra de novo).")
    print("Para colar um texto longo: digite '.', cole o texto e termine com outra linha só com '.'\n")

    while True:
        try:
            linha = input("Você: ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if linha.lower() in {"sair", "exit", "quit"}:
            break
        if not linha:
            continue
        if linha == ".":
            # Modo texto longo: lê até a próxima linha com '.'
            linhas = []
            while (proxima := input()) != ".":
                linhas.append(proxima)
            linha = "\n".join(linhas)
        mensagens.append({"role": "user", "content": linha})

        try:
            texto = responder(client, sistema, mensagens)
        except anthropic.AuthenticationError:
            print("Chave da API inválida. Confira ANTHROPIC_API_KEY.")
            break
        except anthropic.RateLimitError:
            print("Muitas solicitações seguidas. Espere um minuto e mande a mensagem de novo.")
            continue
        except anthropic.APIConnectionError:
            print("Sem conexão com a internet. Mande a mensagem de novo.")
            continue
        except anthropic.APIStatusError as erro:
            print(f"Erro da API ({erro.status_code}): {erro.message}")
            break

        print(f"\nAssistente: {texto}\n")


if __name__ == "__main__":
    main()
