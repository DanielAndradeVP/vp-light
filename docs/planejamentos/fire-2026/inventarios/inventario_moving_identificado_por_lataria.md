# Inventario moving identificado por dados da lataria

Fonte primaria absoluta para `model`, `bulb`, `power` e `fuse`: `equipamentos_extraidos.md`.

Fonte usada para identificar o nome do aparelho: `inventario_moving_especificacao_eletrica.md`.

## Mapa de identificacao

| Model na lataria | Nome identificado | Tipo identificado |
| --- | --- | --- |
| IM-575W2/FC | ACME iMove 575W | Moving Head / Moving Wash |
| IM-575SP2/FC | ACME iMove 575SP | Moving Head / Spot |
| IM-575S | ACME iMove 575S | Moving Head / Spot |

## Equipamentos identificados

| Equipamento | Nome identificado | Tipo | Model | Bulb | Power | Fuse |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ACME iMove 575W | Moving Head / Moving Wash | IM-575W2/FC | MSD 575W / MSR 575/2W | AC230V 60HZ | T10A/250V |
| 2 | ACME iMove 575SP | Moving Head / Spot | IM-575SP2/FC | HMI 575W | AC230V 60HZ | T10A/250V |
| 3 | ACME iMove 575SP | Moving Head / Spot | IM-575SP2/FC | HMI 575W | AC230V 60HZ | T10A/250V |
| 4 | ACME iMove 575SP | Moving Head / Spot | IM-575SP2/FC | HMI 575W | AC230V 60HZ | T10A/250V |
| 5 | ACME iMove 575SP | Moving Head / Spot | IM-575SP2/FC | HMI 575W | AC230V 60HZ | T10A/250V |
| 6 | ACME iMove 575S | Moving Head / Spot | IM-575S | HMI 575W | AC230V 50Hz | T10A/250V |
| 7 | ACME iMove 575W | Moving Head / Moving Wash | IM-575W2/FC | MSD 575W OR MSR 575/2W | AC230V 60HZ | T10A/250V |

## Observacoes

- Os campos `Model`, `Bulb`, `Power` e `Fuse` foram copiados dos dados extraidos da lataria e nao foram normalizados.
- A identificacao do nome foi feita por correspondencia entre o codigo `Model` da lataria e os modelos listados no inventario de especificacao eletrica.
- O arquivo `inventario_moving_especificacao_eletrica.md` lista 8 equipamentos, enquanto `equipamentos_extraidos.md` contem 7 equipamentos extraidos da lataria. Este arquivo consolida somente os 7 equipamentos com dados reais extraidos.
