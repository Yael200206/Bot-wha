import pandas as pd

# 1. Creamos los datos
# Rango del 1 al 500 (el 501 es para que incluya el 500)
lista_indices = list(range(1, 501))

# El número repetido 500 veces
numero_repetido = [4492779268] * 500

# 2. Creamos un Diccionario para el DataFrame
datos = {
    'ID': lista_indices,
    'Numero_Fijo': numero_repetido
}

# 3. Convertimos a DataFrame de Pandas
df = pd.DataFrame(datos)

# 4. Exportamos a Excel
nombre_archivo = 'lista_arduino.xlsx'
df.to_excel(nombre_archivo, index=False)

print(f"✅ Archivo '{nombre_archivo}' generado con éxito.")