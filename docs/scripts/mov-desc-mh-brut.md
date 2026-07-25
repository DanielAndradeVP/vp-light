# mov-desc-mh-brut.js — recomendação: eliminar (duplicata)

Era uma cópia byte-a-byte de `mov-desc-full-reset.js` (mesmo `diff` == vazio, fora formatação). Fix teórico não é reescrever de novo — é **não recriar este arquivo** na próxima leva. Se este F-key precisar existir separado, ele deve **chamar/reusar** a lógica de `mov-desc-full-reset.js` (ver `docs/scripts/mov-desc-full-reset.md`), nunca colar o código de novo.

```js
// Se este F-key ainda for necessário, ele é literalmente o mesmo efeito —
// não crie um segundo arquivo com o mesmo corpo. Aponte o F-key pro script
// mov-desc-full-reset.js existente, ou delete este e mantenha um só.
```

## Notas

- Ver `mov-desc-full-reset.md` pro código corrigido (velocidade de reset real, distinta da velocidade de descida).
- Se a intenção original era mesmo ter uma variante "sem ribalta", `mov-desc-full-reset.js` **já** não toca ribalta — não há distinção real de equipamento entre os dois nomes.
