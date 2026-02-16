from datadog_agent import datadog_agent
from models.hallucination import HallucinationResult

class LLMMetrics:
    def __init__(self):
        self.datadog_statsd = datadog_agent

    def track_request(self):
        return self.datadog_statsd.timed("llm.request.latency")


    def logging_event(self,metric_name, value=1):
        self.datadog_statsd.increment(f"llm.{metric_name}", value)
    
    def log_hallucination(self, hallucination:HallucinationResult):
            print("Logging hallucination metrics to Datadog...")
            self.datadog_statsd.increment("llm.hallucination.score", hallucination.hallucination_score)
            self.datadog_statsd.increment("llm.hallucination.category", hallucination.category)
            self.datadog_statsd.increment("llm.hallucination.reason", hallucination.reason)
            self.datadog_statsd.increment("llm.hallucination.evaluated.count", 1)

            if hallucination.hallucination_score > 0.5:
                self.datadog_statsd.increment("llm.hallucination.flagged.count", 1)
            else:
                self.datadog_statsd.increment("llm.hallucination.clean.count", 1)
            print("Hallucination metrics logged to Datadog.")
    
    def log_prefilter(self, risk_score: float, triggers: list[str]):
        self.datadog_statsd.increment("llm.prefilter.score", risk_score)
        for trigger in triggers:
            self.datadog_statsd.increment(f"llm.prefilter.trigger.{trigger}")
        
    def log_error(self, error_type: str):
        self.datadog_statsd.increment(f"llm.errors.{error_type}")


llm_metrics = LLMMetrics()