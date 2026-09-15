import { RealtimeClient } from "@speechmatics/real-time-client";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowUpRight, AudioLines, CheckCircle2, CircleAlert, Database, Gauge, LockKeyhole, Mic, Radio, ShieldCheck, Sparkles, Terminal, Workflow, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type VoiceCaptureProps = {
  enabled: boolean;
  onPartial: (value: string) => void;
  onFinal: (value: string) => void;
};

function VoiceCapture({ enabled, onPartial, onFinal }: VoiceCaptureProps) {
  const [state, setState] = useState<"idle" | "starting" | "listening" | "stopping" | "error">("idle");
  const [error, setError] = useState("");
  const clientRef = useRef<RealtimeClient | undefined>(undefined);
  const contextRef = useRef<AudioContext | undefined>(undefined);
  const sourceRef = useRef<MediaStreamAudioSourceNode | undefined>(undefined);
  const processorRef = useRef<ScriptProcessorNode | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const tokenMutation = trpc.incidentOps.speechmaticsToken.useMutation();

  useEffect(() => () => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    contextRef.current?.close().catch(() => undefined);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const stop = async () => {
    setState("stopping");
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    await clientRef.current?.stopRecognition({ noTimeout: true }).catch(() => undefined);
    await contextRef.current?.close().catch(() => undefined);
    processorRef.current = undefined;
    sourceRef.current = undefined;
    streamRef.current = undefined;
    contextRef.current = undefined;
    clientRef.current = undefined;
    setState("idle");
  };

  const start = async () => {
    if (!enabled || state !== "idle") return;
    setState("starting");
    setError("");
    try {
      const token = await tokenMutation.mutateAsync();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const context = new AudioContext({ sampleRate: 44100 });
      const client = new RealtimeClient({ url: token.websocketUrl, appId: "cheaproute-incidentops" });
      client.addEventListener("receiveMessage", (event) => {
        const data = event.data;
        if (data.message === "AddPartialTranscript") onPartial(data.metadata.transcript);
        if (data.message === "AddTranscript") onFinal(data.metadata.transcript);
        if (data.message === "Error") setError(data.reason ?? "Speechmatics returned an error");
      });
      await client.start(token.token, {
        transcription_config: { language: "en", model: "standard", max_delay: 0.7, enable_partials: true },
        audio_format: { type: "raw", encoding: "pcm_s16le", sample_rate: 44100 },
      });
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i += 1) pcm[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
        client.sendAudio(pcm.buffer);
      };
      source.connect(processor);
      processor.connect(context.destination);
      clientRef.current = client;
      contextRef.current = context;
      sourceRef.current = source;
      processorRef.current = processor;
      streamRef.current = stream;
      setState("listening");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start the microphone");
      setState("error");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {state === "listening" ? (
        <Button type="button" variant="outline" onClick={() => void stop()} className="border-rose-300 text-rose-700 hover:bg-rose-50">
          <X className="mr-2 h-4 w-4" /> Stop listening
        </Button>
      ) : (
        <Button type="button" variant="outline" disabled={!enabled || state === "starting"} onClick={() => void start()}>
          <Mic className="mr-2 h-4 w-4" /> {state === "starting" ? "Connecting…" : "Speak with Speechmatics"}
        </Button>
      )}
      <span className="text-xs text-slate-500">
        {state === "listening" ? "Live partial and final transcripts are arriving." : enabled ? "Realtime voice bonus path" : "Add SPEECHMATICS_API_KEY to enable voice"}
      </span>
      {error ? <span className="w-full text-xs text-rose-700">{error}</span> : null}
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Activity }) {
  return <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm"><div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.16em] text-slate-500"><span>{label}</span><Icon className="h-4 w-4 text-indigo-500" /></div><div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>;
}

export default function Home() {
  const [transcript, setTranscript] = useState("Checkout latency has increased and users are seeing timeout errors. Investigate the incident and tell me the safest next step.");
  const [partial, setPartial] = useState("");
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof trpc.incidentOps.analyze.useMutation>>["data"]>();
  const status = trpc.incidentOps.status.useQuery();
  const analyze = trpc.incidentOps.analyze.useMutation({ onSuccess: (value) => setAnalysis(value) });

  return (
    <div className="min-h-screen overflow-hidden bg-[#f4f7fb] text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.13),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.10),transparent_32%)]" />
      <main className="relative mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-slate-200/80 pb-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-xl shadow-indigo-200"><Workflow className="h-5 w-5" /></div><div><div className="flex items-center gap-2"><span className="text-lg font-semibold tracking-tight">CheapRoute</span><span className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">IncidentOps</span></div><p className="text-sm text-slate-500">Voice-first operations control plane</p></div></div>
          <div className="flex items-center gap-3 text-xs text-slate-500"><span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Demo environment</span><a className="flex items-center gap-1 font-medium text-slate-700 hover:text-indigo-600" href="https://lablab.ai/ai-hackathons/ai-infra-summit-hackathon" target="_blank" rel="noreferrer">AI Infra Summit <ArrowUpRight className="h-3.5 w-3.5" /></a></div>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end"><div><div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600"><Sparkles className="h-4 w-4" /> Built for the online bimanual VLA track</div><h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950 sm:text-6xl">Turn a spoken incident into a safe, explainable action plan.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">CheapRoute connects Speechmatics voice intake, evidence-grounded diagnosis, cost-aware model routing, and a simulation-first bimanual task plan—without allowing the agent to execute production changes on its own.</p><div className="mt-7 flex flex-wrap gap-2"><span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">Speechmatics bonus path</span><span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">Evidence IDs</span><span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">Approval-gated actions</span></div></div><div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-2xl shadow-indigo-200/50"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Control loop</p><p className="mt-2 text-xl font-semibold">Listen → reason → verify</p></div><AudioLines className="h-8 w-8 text-indigo-300" /></div><div className="mt-7 space-y-3">{[["01","Voice intake","Speechmatics Realtime"],["02","Investigation","Evidence + route"],["03","Simulation","Two-arm verification"]].map(([step,title,detail]) => <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><span className="font-mono text-xs text-indigo-300">{step}</span><div><p className="text-sm font-medium">{title}</p><p className="text-xs text-slate-400">{detail}</p></div><CheckCircle2 className="ml-auto h-4 w-4 text-emerald-400" /></div>)}</div></div></section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Severity" value={analysis?.incident.severity ?? "Ready"} detail={analysis ? "Incident classified" : "Awaiting intake"} icon={CircleAlert} /><Metric label="Route" value={analysis?.route.provider ?? "Offline"} detail={analysis?.route.model ?? "Deterministic safe mode"} icon={Radio} /><Metric label="Latency" value={analysis ? `${analysis.telemetry.latencyMs} ms` : "—"} detail="Measured per run" icon={Gauge} /><Metric label="Persistence" value={analysis?.persistence.persisted ? "Neon" : "Local"} detail={status.data?.neonConfigured ? "Incident history enabled" : "No database required"} icon={Database} /></section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]"><Card className="border-slate-200/80 bg-white/90 shadow-sm"><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="flex items-center gap-2"><Mic className="h-5 w-5 text-indigo-600" /> Incident intake</CardTitle><CardDescription className="mt-2">Speak naturally or edit the transcript. Voice is optional; the demo remains reproducible without it.</CardDescription></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Free-first</span></div></CardHeader><CardContent className="space-y-4"><textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} className="min-h-36 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" aria-label="Incident transcript" /><div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700"><LockKeyhole className="h-4 w-4" /> Server-side voice security</div><p className="mt-2 text-xs leading-5 text-indigo-900/70">The long-lived Speechmatics key never reaches the browser. A short-lived realtime token is created server-side.</p></div><VoiceCapture enabled={Boolean(status.data?.speechmaticsConfigured)} onPartial={setPartial} onFinal={(value) => { setTranscript(value); setPartial(""); }} />{partial ? <p className="rounded-xl bg-slate-100 p-3 text-xs italic text-slate-500">Partial: {partial}</p> : null}<Button className="w-full bg-slate-950 text-white hover:bg-indigo-700" disabled={analyze.isPending || !transcript.trim()} onClick={() => analyze.mutate({ transcript, source: partial ? "speechmatics" : "text" })}>{analyze.isPending ? "Investigating…" : "Run evidence-grounded investigation"}<ArrowUpRight className="ml-2 h-4 w-4" /></Button>{analyze.error ? <p className="text-sm text-rose-700">{analyze.error.message}</p> : null}</CardContent></Card>

        <div className="space-y-6"><Card className="border-slate-200/80 bg-white/90 shadow-sm"><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="flex items-center gap-2"><Terminal className="h-5 w-5 text-indigo-600" /> Investigation trace</CardTitle><CardDescription className="mt-2">Every claim is tied to evidence; every action stays behind approval.</CardDescription></div>{analysis ? <span className="font-mono text-[10px] text-slate-400">{analysis.traceId}</span> : null}</div></CardHeader><CardContent>{analysis ? <div className="space-y-5"><div className="rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-200"><p className="font-semibold text-white">Leading hypothesis</p><p className="mt-1">{analysis.diagnosis.hypotheses[0]}</p><p className="mt-3 text-xs text-slate-400">Confidence {Math.round(analysis.diagnosis.confidence * 100)}% · {analysis.diagnosis.evidenceIds.length} evidence references</p></div><div className="grid gap-2 sm:grid-cols-2">{analysis.evidence.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between"><span className="font-mono text-[10px] text-indigo-600">{item.id}</span><span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{item.kind}</span></div><p className="mt-2 text-sm font-medium text-slate-800">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.content}</p></div>)}</div></div> : <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center"><Activity className="h-7 w-7 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-600">No investigation run yet</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">Use the sample incident or speak into the microphone to populate the trace.</p></div>}</CardContent></Card>

        <div className="grid gap-6 md:grid-cols-2"><Card className="border-slate-200/80 bg-white/90 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Workflow className="h-4 w-4 text-indigo-600" /> Bimanual simulation</CardTitle><CardDescription>Simulation-first online-track deliverable.</CardDescription></CardHeader><CardContent>{analysis ? <><div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> PASS · table set verified</div><p className="mt-2 text-xs leading-5">{analysis.simulation.placedObjects.join(" · ")}</p></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl border border-slate-200 p-3"><p className="font-semibold text-slate-700">Left arm</p><p className="mt-1 text-slate-500">{analysis.simulation.leftArm.join(" → ")}</p></div><div className="rounded-xl border border-slate-200 p-3"><p className="font-semibold text-slate-700">Right arm</p><p className="mt-1 text-slate-500">{analysis.simulation.rightArm.join(" → ")}</p></div></div></> : <p className="text-sm text-slate-500">Run an investigation to generate a coordinated two-arm plan.</p>}</CardContent></Card><Card className="border-slate-200/80 bg-white/90 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Action safety</CardTitle><CardDescription>Proposal is not execution.</CardDescription></CardHeader><CardContent>{analysis ? <div className="space-y-2">{analysis.actions.map((action) => <div key={action.actionId} className="rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-amber-950">{action.title}</p><span className="rounded-full bg-amber-200 px-2 py-1 text-[10px] font-bold uppercase text-amber-900">{action.risk}</span></div><p className="mt-1 text-xs leading-5 text-amber-900/70">Approval required · rollback: {action.rollback}</p></div>)}<p className="pt-1 text-[11px] leading-5 text-slate-500">{analysis.warnings.join(" ")}</p></div> : <p className="text-sm text-slate-500">No production-changing action is available before investigation.</p>}</CardContent></Card></div></div></section>

        <footer className="flex flex-col gap-3 border-t border-slate-200/80 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>CheapRoute IncidentOps · zero-cost local fallback preserved</span><span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> No secrets in the browser · no automatic production changes</span></footer>
      </main>
    </div>
  );
}
