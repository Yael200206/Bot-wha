import dash
from dash import dcc, html
from dash.dependencies import Input, Output
import plotly.graph_objs as go
import pandas as pd
import os

# Configuración
FILE_PATH = 'datos.xlsx'
# Nombre de la hoja que tiene la matriz (Hoja4 según tus archivos)
SHEET_NAME = 'Hoja4' 

app = dash.Dash(__name__)

app.layout = html.Div([
    html.H1("Superficie 3D en Tiempo Real", style={'textAlign': 'center'}),
    dcc.Graph(id='grafica-superficie', style={'height': '85vh'}),
    dcc.Interval(id='intervalo', interval=2000, n_intervals=0)
])

@app.callback(Output('grafica-superficie', 'figure'),
              Input('intervalo', 'n_intervals'))
def update_surface(n):
    try:
        # Leemos la matriz del Excel
        # index_col=0 para que use la primera columna (X/Y) como etiquetas
        df = pd.read_excel(FILE_PATH, sheet_name=SHEET_NAME, index_col=0)
        
        # Los valores de la matriz son Z
        z_data = df.values
        # Las cabeceras de columnas son X
        x_data = df.columns
        # El índice de filas es Y
        y_data = df.index

        fig = go.Figure(data=[go.Surface(z=z_data, x=x_data, y=y_data, colorscale='Viridis')])

        fig.update_layout(
            title='Visualización de Malla Matemática',
            scene=dict(
                xaxis_title='Eje X',
                yaxis_title='Eje Y',
                zaxis_title='Eje Z'
            ),
            autosize=True,
            margin=dict(l=65, r=50, b=65, t=90)
        )
        return fig

    except Exception as e:
        print(f"Error: {e}")
        return dash.no_update

if __name__ == '__main__':
    # Usamos app.run en lugar de app.run_server para evitar el error anterior
    app.run(debug=True, port=8050)