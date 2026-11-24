# Amp e pedais (app do Mac)

O Amp roda só no app desktop. Ele liga um modelo NAM (`.nam`) à interface de áudio e toca em tempo real, com efeitos depois do amp. No webapp a aba não aparece.

## Aba Amp

- Interface externa única (sem Bluetooth nem alto-falante interno), um canal de entrada e um de saída, buffer de 64 ou 128 amostras. Metrônomo, afinador e prévias ficam parados enquanto o Amp está ligado.
- Configuração recolhível: interface, entrada, saída, buffer e modelo. Fica travada com o Amp ligado.
- Teto fixo de saída em -12 dBFS. O knob Volume só atenua, de -48 a 0 dB (padrão 0 dB). O limitador de saída continua ativo.
- Knob Dry / Wet: 0% é só a guitarra limpa, 100% é só o amp. O dry misturado é a guitarra sem gate e sem drive.
- Medidores de entrada e saída em dBFS, com marca de pico e aviso de clip. Osciloscópio com guitarra (cinza) e saída (laranja), alinhado por cruzamento de zero, com escala automática.
- Os knobs aceitam arrasto vertical, roda do mouse, setas, Home, End e duplo clique para voltar ao padrão.
- Configuração salva em `pratica.amp.v2` e pedais em `pratica.amp.fx.v1` (localStorage do app).

## Pedais

Ordem fixa: Gate, Overdrive, Amp, EQ, Phaser, Flanger, Chorus, Tremolo, Delay, Reverb. Todos começam desligados. Cada pedal tem chave liga/desliga com rampa de cerca de 10 ms, sem estalo.

| Pedal | Controles |
|---|---|
| Noise gate | limiar, soltura |
| Overdrive | drive, tom, nível |
| EQ 3 bandas | graves, médios, agudos (prateleiras e pico) |
| Phaser | velocidade, profundidade, feedback, mix |
| Flanger | velocidade, profundidade, feedback, mix |
| Chorus | velocidade, profundidade, mix |
| Tremolo | velocidade, profundidade |
| Delay | tipo (digital, analógico, slapback), tempo, feedback, tom, mix |
| Reverb | tipo (sala, hall, plate), tamanho, abafar, pré-delay, mix |

Gate e overdrive entram antes do modelo. O resto entra depois da mistura dry/wet e antes do ganho de saída.

## Implementação

- Motor de efeitos em `crates/audio-engine/src/fx.rs`. Sem alocação nem trava no callback. Os parâmetros chegam por atomics (`FxParams`, 40 valores).
- `apps/desktop/src-tauri/src/amp.rs`: `amp_start` recebe mistura, ganho e efeitos. `amp_set` ajusta dry/wet e volume. `amp_fx_set` envia todos os pedais. `amp_meters` devolve picos e a forma de onda, chamado a cada 40 ms.
- Definição única dos pedais em `packages/core/src/amp-fx.ts`. A ordem e os padrões espelham `fx.rs`. O teste `amp-fx.test.ts` guarda a cópia dos padrões do Rust.

## O que ainda não foi validado

- Nenhum pedal foi ouvido com guitarra real além do uso do Pedro; níveis do drive e do reverb foram calibrados por cálculo e teste.
- Delay não sincroniza com o BPM do metrônomo.
- Teste longo (10 minutos em 64 amostras), medição de latência de ida e volta e as três bandeiras de erro de stream vistas nos testes da bancada A0 continuam abertos. O A0 não está aprovado como pedal.
- Licença do modelo JCM800 não confirmada. Modelos `.nam` não entram no repositório.

## Testes

`cargo test -p audio-engine` cobre: sinal intacto com tudo desligado, cada efeito finito e limitado, parâmetros extremos, tempo do eco do delay, cauda e nível do reverb, gate, EQ e retorno ao sinal original ao desligar.
