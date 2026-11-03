import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;

/** Local Java worker for FFmpeg audio extraction and whisper.cpp transcription. */
public final class VideoProcessor {
    private static final int CHUNK_SECONDS = 600;

    private VideoProcessor() {}

    public static void main(String[] args) {
        try {
            if (args.length == 1 && args[0].equals("--check")) {
                System.out.println("Java video worker source compiles and runs.");
                return;
            }
            if (args.length != 6) throw new IllegalArgumentException("Expected input, work directory, FFmpeg, whisper.cpp, model path, and language code.");
            process(Path.of(args[0]), Path.of(args[1]), args[2], args[3], Path.of(args[4]), args[5]);
        } catch (Exception error) {
            System.err.println(error.getMessage() == null ? "Local video processing failed." : error.getMessage());
            System.exit(1);
        }
    }

    private static void process(Path input, Path workDir, String ffmpeg, String whisper, Path model, String language) throws Exception {
        if (!Files.isRegularFile(input)) throw new IOException("The media file is missing or unreadable.");
        if (!Files.isRegularFile(model)) throw new IOException("Whisper model file is missing. Download a multilingual ggml model and set WHISPER_MODEL_PATH.");
        Files.createDirectories(workDir);
        Path pattern = workDir.resolve("chunk-%03d.wav");
        progress("extracting", 18, "Extracting audio and splitting it into ten-minute chunks");
        List<String> extraction = new ArrayList<>(List.of(ffmpeg, "-y", "-i", input.toString(), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "segment", "-segment_time", Integer.toString(CHUNK_SECONDS), "-reset_timestamps", "1", "-segment_format", "wav", pattern.toString()));
        run(extraction, workDir.resolve("ffmpeg.log"), Duration.ofHours(6));

        List<Path> chunks;
        try (var paths = Files.list(workDir)) {
            chunks = paths.filter(path -> path.getFileName().toString().matches("chunk-\\d+\\.wav"))
                    .sorted(Comparator.comparing(path -> path.getFileName().toString())).toList();
        }
        if (chunks.isEmpty()) throw new IOException("No audio track was found. Choose a video or audio file that contains speech.");

        for (int index = 0; index < chunks.size(); index++) {
            int progress = 25 + Math.round((index * 33f) / chunks.size());
            progress("transcribing", progress, "Transcribing audio chunk " + (index + 1) + " of " + chunks.size());
            String baseName = String.format(java.util.Locale.ROOT, "recognized-%03d", index);
            Path outputBase = workDir.resolve(baseName);
            List<String> command = new ArrayList<>(List.of(whisper, "--model", model.toString(), "--file", chunks.get(index).toString(), "--language", language.isBlank() ? "auto" : language, "--output-json", "--output-file", outputBase.toString(), "--no-prints", "--suppress-nst"));
            run(command, workDir.resolve(baseName + ".log"), Duration.ofHours(8));
            if (!Files.isRegularFile(Path.of(outputBase + ".json"))) throw new IOException("whisper.cpp completed without producing transcript JSON for chunk " + (index + 1) + ".");
        }
        progress("transcribing", 59, "Transcript and detected language are ready");
    }

    private static void run(List<String> command, Path logFile, Duration timeout) throws Exception {
        Process process;
        try {
            process = new ProcessBuilder(command).redirectErrorStream(true).redirectOutput(logFile.toFile()).start();
        } catch (IOException error) {
            String executable = command.get(0);
            throw new IOException(executable + " is unavailable. Check its installation and PATH, or configure its full executable path.", error);
        }
        if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
            process.destroyForcibly();
            throw new IOException(command.get(0) + " timed out while processing local media.");
        }
        if (process.exitValue() != 0) {
            String output = Files.exists(logFile) ? Files.readString(logFile, StandardCharsets.UTF_8) : "";
            if (output.length() > 5000) output = output.substring(output.length() - 5000);
            throw new IOException(output.isBlank() ? command.get(0) + " exited with code " + process.exitValue() + "." : output.trim());
        }
    }

    private static void progress(String stage, int percent, String message) {
        System.out.println("PROGRESS\t" + stage + "\t" + percent + "\t" + message.replace('\t', ' '));
        System.out.flush();
    }
}
