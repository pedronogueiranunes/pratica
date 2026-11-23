// Host de referência do Prática. DSP vem do NeuralAmpModelerCore (MIT).
#include <NAM/get_dsp.h>
#include <algorithm>
#include <filesystem>
#include <stdexcept>
#include <fstream>
#include <iostream>
#include <iomanip>
#include <vector>
#include <string>
int main(int argc, char** argv) {
  if (argc != 4 && argc != 5) { std::cerr << "Uso: pratica-nam-oracle modelo.nam entrada.json saida.json [64|128]\n"; return 2; }
  try {
    const int frames = argc == 5 ? std::stoi(argv[4]) : 128;
    if (frames != 64 && frames != 128) throw std::runtime_error("Use buffer 64/128.");
    nlohmann::json input;
    std::ifstream in(argv[2]);
    if (!in) throw std::runtime_error("Não foi possível abrir a entrada.");
    in >> input;
    if (!input.is_array() || input.empty() || input.size() > 2000000) throw std::runtime_error("Sinal inválido.");
    std::vector<NAM_SAMPLE> samples = input.get<std::vector<NAM_SAMPLE>>();
    std::vector<NAM_SAMPLE> output(samples.size());
    nam::DspLoadOptions options; options.prewarm = false;
    auto model = nam::get_dsp(std::filesystem::path(argv[1]), options);
    if (!model) throw std::runtime_error("Modelo indisponível.");
    if (model->NumInputChannels()!=1 || model->NumOutputChannels()!=1) throw std::runtime_error("O oráculo A0 aceita somente modelos mono.");
    model->SetPrewarmOnReset(false);
    const auto rate = model->GetExpectedSampleRate() > 0 ? model->GetExpectedSampleRate() : 48000.;
    model->Reset(rate, frames);
    for (size_t offset = 0; offset < samples.size(); offset += frames) {
      const auto n = static_cast<int>(std::min(size_t(frames), samples.size() - offset));
      auto* source = samples.data() + offset; auto* dest = output.data() + offset;
      model->process(&source, &dest, n);
    }
    std::ofstream out(argv[3]);
    if (!out) throw std::runtime_error("Não foi possível gravar a saída.");
    out << std::setprecision(17) << nlohmann::json(output);
    return out.good() ? 0 : 1;
  } catch (const std::exception& error) { std::cerr << error.what() << '\n'; return 1; }
}
