import csv
import sys
import os
import time

input_file = '/home/bruno/Documents/CodeVSCODE/Inovaskill/DeusaInsights/dadosCNAE/K3241.K03200Y1.D60613.ESTABELE'
output_file = '/home/bruno/Documents/CodeVSCODE/Inovaskill/DeusaInsights/dadosCNAE/sp_4712100_estabelecimentos.csv'

CNAE_INDEX = 11
UF_INDEX = 19
TARGET_CNAE = '4712100'
TARGET_UF = 'SP'

def process_file():
    print(f"Iniciando o processamento do arquivo: {input_file}")
    start_time = time.time()
    
    total_lines = 0
    filtered_count = 0
    
    try:
        with open(input_file, 'r', encoding='latin1') as infile, \
             open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            
            reader = csv.reader(infile, delimiter=';', quotechar='"')
            writer = csv.writer(outfile, delimiter=';', quotechar='"')
            
            for row in reader:
                total_lines += 1
                if len(row) > max(CNAE_INDEX, UF_INDEX):
                    cnae = row[CNAE_INDEX]
                    uf = row[UF_INDEX]
                    
                    if cnae == TARGET_CNAE and uf == TARGET_UF:
                        writer.writerow(row)
                        filtered_count += 1
                        
                if total_lines % 5000000 == 0:
                    print(f"Processadas {total_lines} linhas. Encontrados: {filtered_count}...")
                    
    except Exception as e:
        print(f"Ocorreu um erro durante o processamento: {e}")
        return

    end_time = time.time()
    duration = end_time - start_time
    
    print(f"\n--- Resumo do Processamento ---")
    print(f"Tempo total: {duration:.2f} segundos")
    print(f"Total de linhas analisadas: {total_lines}")
    print(f"Total de registros encontrados (CNAE {TARGET_CNAE}, UF {TARGET_UF}): {filtered_count}")
    print(f"Os dados filtrados foram salvos em: {output_file}")

if __name__ == '__main__':
    process_file()
