from llm import skinnovaLLM
from llm.hallucination import hallucination_detector
from llm.prefilter import skinnova_prefilter
from services.llm_datadog_metrics import llm_metrics
from services.user_persona_metrics import user_persona_metrics
from utils.user_msg import get_recent_user_message
from utils.ai_msg import get_vertex_ai_message
from models.llm_response import LLMResponse

async def llm_chat(payload: dict)->LLMResponse:
        # Call the Skinnova LLM chat model
        res = skinnovaLLM.vertex_chat(payload)
        llm_metrics.logging_event("chats.total",1)
        llm_response : LLMResponse = get_vertex_ai_message(res)

        if llm_response.Type == "error":
                llm_metrics.log_error("json_parsing_failure")
                llm_metrics.logging_event("hallucination.score",1)
                return llm_response

        try: 
                # Check if hallucination detection is required
                prefilter_result = skinnova_prefilter(llm_response)
                recent_user_msgs = get_recent_user_message(payload)
                print(f"Prefilter result: Risk Score={prefilter_result.risk_score}, Triggers={prefilter_result.triggers}, Should Evaluate={prefilter_result.should_evaluate}")
                llm_metrics.log_prefilter(prefilter_result.risk_score, prefilter_result.triggers)
                if prefilter_result.should_evaluate:
                   print("Prefilter triggered hallucination detection.")
                   hallucination = hallucination_detector.detect_hallucination(recent_user_msgs, llm_response.Data.Response) 
                   llm_metrics.log_hallucination(hallucination)

                   if hallucination.hallucination_score > 0.5:
                        user_persona_metrics.log_user_affected()
                        if llm_response.Data.Profile is not None:
                          user_persona_metrics.emit_persona_risk(llm_response.Data.Profile)                     
                         


        except Exception as e:
                llm_metrics.log_error("hallucination_detection_failure")
                print(f"Error logging hallucination metrics: {e}")
                return LLMResponse(type="error",data={"response":"something went wrong"})
        return llm_response