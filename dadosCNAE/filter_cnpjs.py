import argparse
import csv
import os
import time
from pathlib import Path

CNAE_INDEX = 11
UF_INDEX = 19
ALLOWED_CNAES = {"4711302", "4711301", "4712100", "4721102", "4722901"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Filtra localmente o arquivo ESTABELE sem chamar APIs externas.",
    )
    parser.add_argument("input", type=Path, help="Arquivo ESTABELE de entrada")
    parser.add_argument("output", type=Path, help="CSV de saída")
    parser.add_argument(
        "--cnae",
        action="append",
        choices=sorted(ALLOWED_CNAES),
        dest="cnaes",
        help="CNAE alvo; repita a opção para incluir mais de um (padrão: 4712100)",
    )
    parser.add_argument("--uf", default="SP", help="UF alvo (padrão: SP)")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Autoriza explicitamente substituir o arquivo de saída existente",
    )
    return parser.parse_args()


def process_file(
    input_file: Path,
    output_file: Path,
    target_cnaes: set[str],
    target_uf: str,
    overwrite: bool,
) -> None:
    input_file = input_file.resolve()
    output_file = output_file.resolve()
    if input_file == output_file:
        raise ValueError("Entrada e saída devem ser arquivos diferentes.")
    if not input_file.is_file():
        raise FileNotFoundError(f"Arquivo de entrada não encontrado: {input_file}")
    if output_file.exists() and not overwrite:
        raise FileExistsError(
            f"Arquivo de saída já existe: {output_file}. Use --overwrite para substituí-lo.",
        )

    output_file.parent.mkdir(parents=True, exist_ok=True)
    temporary_output = output_file.with_name(f".{output_file.name}.{os.getpid()}.tmp")
    print(f"Iniciando o processamento local do arquivo: {input_file}")
    start_time = time.time()
    total_lines = 0
    filtered_count = 0

    try:
        with input_file.open("r", encoding="latin1", newline="") as infile, temporary_output.open(
            "x",
            encoding="utf-8",
            newline="",
        ) as outfile:
            reader = csv.reader(infile, delimiter=";", quotechar='"')
            writer = csv.writer(outfile, delimiter=";", quotechar='"')

            for row in reader:
                total_lines += 1
                if len(row) > max(CNAE_INDEX, UF_INDEX):
                    if row[CNAE_INDEX] in target_cnaes and row[UF_INDEX].upper() == target_uf:
                        writer.writerow(row)
                        filtered_count += 1

                if total_lines % 5_000_000 == 0:
                    print(f"Processadas {total_lines} linhas. Encontrados: {filtered_count}...")

        if overwrite:
            os.replace(temporary_output, output_file)
        else:
            os.link(temporary_output, output_file)
            temporary_output.unlink()
    except Exception:
        temporary_output.unlink(missing_ok=True)
        raise

    duration = time.time() - start_time
    print("\n--- Resumo do Processamento ---")
    print(f"Tempo total: {duration:.2f} segundos")
    print(f"Total de linhas analisadas: {total_lines}")
    print(f"Total de registros encontrados: {filtered_count}")
    print(f"CNAEs: {', '.join(sorted(target_cnaes))} | UF: {target_uf}")
    print(f"Os dados filtrados foram salvos em: {output_file}")


if __name__ == "__main__":
    args = parse_args()
    process_file(
        args.input,
        args.output,
        set(args.cnaes or ["4712100"]),
        args.uf.strip().upper(),
        args.overwrite,
    )
