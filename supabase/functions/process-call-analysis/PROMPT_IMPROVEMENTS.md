# 🤖 AI Prompt Improvements for Call Analysis

## Current Prompt Strengths
✅ Clear task structure  
✅ Specific output schema  
✅ Business context (Clark Mortgages)  
✅ Mortgage follow-up rules  
✅ Tool call integration  

## 🔧 Suggested Improvements

### 1. **Enhanced Sentiment Detection**
```
## SENTIMENT ANALYSIS GUIDELINES:
- **Positive**: Customer engaged, interested, provided details, asked questions, agreed to follow-up
- **Neutral**: Polite but disinterested, minimal engagement, brief responses  
- **Negative**: Angry, hung up, explicitly refused service, rude responses
- **Special Cases**: 
  - Voicemail = leave sentiment blank
  - Wrong number = "Neutral"
  - Busy/unavailable = "Neutral"
```

### 2. **Improved Mortgage Detail Extraction**
```
## MORTGAGE DETAILS PRIORITY (in order of importance):
1. **Fixed Rate Expiry Date** - Most critical for follow-up timing
2. **Current Interest Rate** - For comparison/savings calculation  
3. **Mortgage Balance** - For refinancing assessment
4. **Property Value** - For LTV calculation
5. **Monthly Payment** - For affordability assessment
6. **Mortgage Type** (tracker, variable, fixed)
7. **Years Remaining** on mortgage term

## ENHANCED KEY_DETAILS FORMAT:
"Fixed rate 2.5% expires March 2026, £180k balance, 3br house £320k value, employed teacher"
```

### 3. **Tool Call Context Integration**
```
## TOOL CALL ANALYSIS RULES:
- **calendar_booking_successful** = call_with_agent_booked: true
- **calendar_booking_attempted** but failed = mention in follow_up_reason
- **contact_info_updated** = positive engagement signal
- **Multiple failed tool calls** = reduce conversation_quality_score

Example: "Customer interested but calendar booking failed due to technical issues - manual follow-up needed"
```

### 4. **Follow-up Date Calculation Examples**
```
## FOLLOW-UP DATE EXAMPLES:
- "2-year fixed started Jan 2024" → midterm: "2025-01-01", expiry: "2025-08-01"  
- "Fixed rate ends next year" → expiry: "6 months before mentioned date"
- "Call me in 3 months" → explicit: "add 3 months to today"
- "My rate expires in March" → expiry: "2025-09-01" (6 months before March 2026)
```

### 5. **Quality Score Improvements**
```
## CONVERSATION QUALITY FACTORS:
Base Score: 5
+3: Customer provided mortgage details
+2: Positive sentiment 
+2: Agent booking successful
+1: Customer asked questions
+1: Call duration >90 seconds
-1: Customer seemed rushed
-2: Negative sentiment
-3: Explicit DNC request
-2: Call <30 seconds
```

### 6. **Enhanced Business Success Detection**
```
## BUSINESS SUCCESS CRITERIA (call_business_successful = true):
- Agent appointment booked ✅
- Detailed mortgage information obtained + Positive/Neutral sentiment ✅  
- Customer expressed interest in review + provided contact preference ✅
- Customer requested callback with specific timing ✅

## BUSINESS FAILURE (call_business_successful = false):
- DNC request
- Wrong number
- Immediate hang-up (<10 seconds)
- Hostile response
- No mortgage information + Negative sentiment
```

### 7. **Improved Output Schema**
```json
{
  "key_details": "Fixed 3.2% expires Jun 2025, £240k balance, £400k house value, IT contractor",
  "user_sentiment": "Positive",
  "asked_explicitly_to_NOT_call_again": false,
  "follow_up_date": "2024-12-01",
  "call_with_agent_booked": true,
  "confidence_level": "high",
  "call_duration_seconds": 127,
  "mortgage_opportunity": "high"
}
```

## 🎯 Implementation Priority

### **High Priority (Implement First):**
1. Enhanced sentiment guidelines
2. Improved mortgage detail extraction format
3. Tool call context integration

### **Medium Priority:**
1. Follow-up date calculation examples  
2. Quality score improvements

### **Low Priority (Future Enhancement):**
1. Confidence level scoring
2. Opportunity assessment
3. Call duration analysis

## 🧪 Testing Recommendations

1. **Test with edge cases:**
   - Voicemail calls
   - Wrong numbers  
   - Very short calls (<15 seconds)
   - Calls with no mortgage discussion

2. **Validate mortgage parsing:**
   - Complex scenarios (multiple properties)
   - Unclear dates ("sometime next year")
   - Mixed information (fixed + tracker mortgages)

3. **Sentiment accuracy:**
   - Polite but disinterested customers
   - Customers who provide info but don't book
   - Frustrated but not hostile customers 