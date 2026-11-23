//! Leitura offline de dois canais simultâneos. Não é usada pela callback.
use std::fs;
fn u16_at(data: &[u8], i: usize) -> Result<u16, String> {
    data.get(i..i + 2)
        .map(|b| u16::from_le_bytes(b.try_into().unwrap()))
        .ok_or("WAV truncado.".into())
}
fn u32_at(data: &[u8], i: usize) -> Result<u32, String> {
    data.get(i..i + 4)
        .map(|b| u32::from_le_bytes(b.try_into().unwrap()))
        .ok_or("WAV truncado.".into())
}
pub fn decode(bytes: &[u8]) -> Result<(u32, Vec<f32>, Vec<f32>), String> {
    if bytes.get(..4) != Some(b"RIFF") || bytes.get(8..12) != Some(b"WAVE") {
        return Err("Use WAV RIFF PCM ou float, com referência no canal 1 e retorno no 2.".into());
    }
    let mut offset = 12_usize;
    let mut fmt = None;
    let mut audio = None;
    while offset + 8 <= bytes.len() {
        let size = u32_at(bytes, offset + 4)? as usize;
        let end = offset
            .checked_add(8)
            .and_then(|n| n.checked_add(size))
            .ok_or("WAV grande demais.")?;
        let chunk = bytes.get(offset + 8..end).ok_or("WAV truncado.")?;
        match &bytes[offset..offset + 4] {
            b"fmt " => fmt = Some(chunk),
            b"data" => audio = Some(chunk),
            _ => {}
        }
        offset = end + (size % 2);
    }
    let fmt = fmt.ok_or("WAV sem formato.")?;
    let data = audio.ok_or("WAV sem amostras.")?;
    let mut tag = u16_at(fmt, 0)?;
    let channels = u16_at(fmt, 2)? as usize;
    let sr = u32_at(fmt, 4)?;
    let align = u16_at(fmt, 12)? as usize;
    let bits = u16_at(fmt, 14)? as usize;
    if tag == 0xfffe && fmt.len() >= 40 {
        tag = u16_at(fmt, 24)?;
    }
    if channels != 2
        || !(8000..=192000).contains(&sr)
        || !matches!((tag, bits), (1, 16) | (1, 24) | (1, 32) | (3, 32))
        || align != channels * (bits / 8)
        || data.len() % align != 0
    {
        return Err("Use dois canais simultâneos, PCM 16/24/32 bits ou float32, sem normalizar canais separados.".into());
    }
    let sample = |b: &[u8]| -> f32 {
        match (tag, bits) {
            (1, 16) => i16::from_le_bytes(b[..2].try_into().unwrap()) as f32 / 32768.0,
            (1, 24) => ((i32::from_le_bytes([0, b[0], b[1], b[2]])) >> 8) as f32 / 8388608.0,
            (1, 32) => i32::from_le_bytes(b[..4].try_into().unwrap()) as f32 / 2147483648.0,
            _ => f32::from_le_bytes(b[..4].try_into().unwrap()),
        }
    };
    let mut left = Vec::with_capacity(data.len() / align);
    let mut right = Vec::with_capacity(data.len() / align);
    for frame in data.chunks_exact(align) {
        let a = sample(frame);
        let b = sample(&frame[bits / 8..]);
        if !a.is_finite() || !b.is_finite() {
            return Err("WAV com NaN/Inf.".into());
        }
        left.push(a);
        right.push(b);
    }
    Ok((sr, left, right))
}
pub fn read_stereo(path: &str) -> Result<(u32, Vec<f32>, Vec<f32>), String> {
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > 128_000_000 {
        return Err("Limite da bancada: WAV de 128 MB.".into());
    }
    decode(&fs::read(path).map_err(|e| e.to_string())?)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn recusa_truncamento_e_canais_ausentes() {
        assert!(decode(b"RIFF").is_err());
        assert!(decode(&[0; 48]).is_err());
    }
}
