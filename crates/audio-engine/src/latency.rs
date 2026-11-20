//! Descrição dos dispositivos e escolha do melhor para cada uso.
//!
//! A lógica de pontuação é pura (sem cpal) para poder ser testada e
//! reaproveitada em outras plataformas.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Connection {
    BuiltIn,
    Usb,
    Bluetooth,
    Thunderbolt,
    Pci,
    FireWire,
    Hdmi,
    DisplayPort,
    Line,
    Spdif,
    Network,
    Virtual,
    Aggregate,
    Unknown,
}

impl Connection {
    /// Atraso típico extra que a conexão costuma somar, além do buffer.
    pub fn typical_extra_ms(self) -> f32 {
        match self {
            Connection::Bluetooth => 150.0,
            Connection::Network => 40.0,
            Connection::Hdmi | Connection::DisplayPort => 20.0,
            Connection::Virtual | Connection::Aggregate => 5.0,
            _ => 0.0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub manufacturer: Option<String>,
    pub connection: Connection,
    pub is_input: bool,
    pub is_output: bool,
    pub is_default_input: bool,
    pub is_default_output: bool,
    pub input_channels: u16,
    pub output_channels: u16,
    pub sample_rate: Option<u32>,
    pub buffer_min: Option<u32>,
    pub buffer_max: Option<u32>,
    /// Latência medida no último uso (ms), se houver.
    pub measured_input_ms: Option<f32>,
    pub measured_output_ms: Option<f32>,
}

impl DeviceInfo {
    /// Estimativa de latência numa direção: medida, se houver; senão o
    /// menor buffer possível mais o atraso típico da conexão.
    pub fn estimated_ms(&self, input: bool) -> f32 {
        let measured = if input { self.measured_input_ms } else { self.measured_output_ms };
        if let Some(ms) = measured {
            return ms;
        }
        let sr = self.sample_rate.unwrap_or(48_000) as f32;
        let buffer = self.buffer_min.unwrap_or(512) as f32;
        buffer / sr * 1000.0 + self.connection.typical_extra_ms()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Purpose {
    /// Entrada para o afinador e, depois, para tocar junto.
    Instrument,
    /// Saída do metrônomo e das músicas.
    Playback,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recommendation {
    pub device_id: String,
    pub score: f32,
    pub estimated_ms: f32,
    /// Motivo curto, já em texto de interface (código; o app traduz).
    pub reason: RecommendationReason,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RecommendationReason {
    AudioInterface,
    LowestLatency,
    OnlyOption,
    BluetoothWarning,
}

fn is_interface_like(c: Connection) -> bool {
    matches!(c, Connection::Usb | Connection::Thunderbolt | Connection::Pci | Connection::FireWire)
}

/// Ordena os dispositivos do melhor para o pior para um uso.
pub fn rank(devices: &[DeviceInfo], purpose: Purpose) -> Vec<Recommendation> {
    let input = purpose == Purpose::Instrument;
    let candidates: Vec<&DeviceInfo> = devices
        .iter()
        .filter(|d| if input { d.is_input && d.input_channels > 0 } else { d.is_output && d.output_channels > 0 })
        .collect();

    let mut out: Vec<Recommendation> = candidates
        .iter()
        .map(|d| {
            let ms = d.estimated_ms(input);
            // Menos latência é melhor; interface de áudio ganha bônus para
            // instrumento (entrada de linha, ganho certo, sem processamento de voz).
            let mut score = 100.0 - ms;
            if input && is_interface_like(d.connection) {
                score += 25.0;
            }
            if d.connection == Connection::Bluetooth {
                score -= 60.0;
            }
            if d.connection == Connection::Virtual || d.connection == Connection::Aggregate {
                score -= 10.0;
            }
            let reason = if d.connection == Connection::Bluetooth {
                RecommendationReason::BluetoothWarning
            } else if candidates.len() == 1 {
                RecommendationReason::OnlyOption
            } else if input && is_interface_like(d.connection) {
                RecommendationReason::AudioInterface
            } else {
                RecommendationReason::LowestLatency
            };
            Recommendation { device_id: d.id.clone(), score, estimated_ms: ms, reason }
        })
        .collect();
    out.sort_by(|a, b| b.score.total_cmp(&a.score));
    out
}

/// Sugere trocar de dispositivo só quando o ganho é claro (evita ficar
/// sugerindo troca toda hora por 1 ms de diferença).
pub fn should_suggest_switch(current: &Recommendation, best: &Recommendation) -> bool {
    current.device_id != best.device_id
        && (best.score - current.score >= 10.0 || current.reason == RecommendationReason::BluetoothWarning)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dev(id: &str, connection: Connection, input: bool, buffer_min: u32) -> DeviceInfo {
        DeviceInfo {
            id: id.into(),
            name: id.into(),
            manufacturer: None,
            connection,
            is_input: input,
            is_output: !input,
            is_default_input: false,
            is_default_output: false,
            input_channels: if input { 2 } else { 0 },
            output_channels: if input { 0 } else { 2 },
            sample_rate: Some(48_000),
            buffer_min: Some(buffer_min),
            buffer_max: Some(4096),
            measured_input_ms: None,
            measured_output_ms: None,
        }
    }

    #[test]
    fn interface_usb_vence_o_microfone_embutido_para_instrumento() {
        let devices = vec![dev("mic", Connection::BuiltIn, true, 15), dev("focusrite", Connection::Usb, true, 32)];
        let r = rank(&devices, Purpose::Instrument);
        assert_eq!(r[0].device_id, "focusrite");
        assert_eq!(r[0].reason, RecommendationReason::AudioInterface);
    }

    #[test]
    fn bluetooth_fica_por_ultimo_e_gera_aviso() {
        let devices = vec![dev("airpods", Connection::Bluetooth, false, 128), dev("alto-falante", Connection::BuiltIn, false, 512)];
        let r = rank(&devices, Purpose::Playback);
        assert_eq!(r[0].device_id, "alto-falante");
        assert_eq!(r[1].reason, RecommendationReason::BluetoothWarning);
        assert!(should_suggest_switch(&r[1], &r[0]));
    }

    #[test]
    fn medicao_real_tem_prioridade_sobre_estimativa() {
        let mut a = dev("a", Connection::BuiltIn, false, 64);
        a.measured_output_ms = Some(40.0);
        let b = dev("b", Connection::BuiltIn, false, 512);
        let r = rank(&[a, b], Purpose::Playback);
        assert_eq!(r[0].device_id, "b");
    }

    #[test]
    fn diferenca_pequena_nao_sugere_troca() {
        let devices = vec![dev("a", Connection::BuiltIn, false, 256), dev("b", Connection::BuiltIn, false, 128)];
        let r = rank(&devices, Purpose::Playback);
        let current = r.iter().find(|x| x.device_id == "a").unwrap();
        assert!(!should_suggest_switch(current, &r[0]));
    }
}
