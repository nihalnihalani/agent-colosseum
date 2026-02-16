from models.user import User
from pydantic import BaseModel, Field


class DataModel(BaseModel):
    Profile :  User | None = Field(alias="profile",default=None)
    Response : str | None = Field(alias="response",default=None)
    MorningRoutine : list | None = Field(alias="morning_routine",default=None)
    EveningRoutine : list | None = Field(alias="evening_routine",default=None)
    NightRoutine : list | None = Field(alias="night_routine",default=None)
    UsageInstructions : str | None = Field(alias="usage_instructions",default=None)

class LLMResponse(BaseModel):
    Type: str = Field(..., alias="type", description="type of response") # values : "chat", "routine" or "error"
    Data : DataModel = Field(..., alias="data")

   