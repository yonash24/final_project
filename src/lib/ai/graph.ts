/**
 * graph.ts
 * Core LangGraph implementation for the AI Agent.
 * This file defines the agentic workflow as a directed graph.
 */

import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { classifyIntent, type ChatMessage, type ClassifiedIntent } from "./intent-classifier";
import { getChatModel } from "./gemini";
import {
    searchActivities,
    searchEvents,
    getActivityByName,
    getUpcomingEvents,
    type ActivityRow,
    type EventRow,
} from "@/lib/db/chat-queries";
import {
    CHAT_SYSTEM_PROMPT,
    formatActivitiesForContext,
    formatEventsForContext,
} from "./prompts";

// ─── State Definition ──────────────────────────────────

/**
 * The state of our agent, passed between nodes.
 */
const AgentState = Annotation.Root({
    message: Annotation<string>(),
    history: Annotation<ChatMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),
    classified: Annotation<ClassifiedIntent | null>(),
    searchResults: Annotation<{
        activities: ActivityRow[];
        events: EventRow[];
    }>({
        reducer: (x, y) => y, // Replace results
        default: () => ({ activities: [], events: [] }),
    }),
    response: Annotation<string>(),
    error: Annotation<string | null>(),
});

type StateType = typeof AgentState.State;

// ─── Nodes ──────────────────────────────────────────────

/**
 * Node 1: Classify the user's intent and extract filters.
 */
async function classifyNode(state: StateType) {
    try {
        const classified = await classifyIntent(state.message, state.history);
        return { classified };
    } catch {
        return { error: "Classification failed" };
    }
}

/**
 * Node 2: Retrieve relevant data from Supabase based on the intent.
 */
async function retrieveNode(state: StateType) {
    const classified = state.classified;
    if (!classified) return { error: "No intent found" };

    let activities: ActivityRow[] = [];
    let events: EventRow[] = [];

    switch (classified.intent) {
        case 'search_activities':
        case 'age_inquiry':
        case 'price_inquiry':
        case 'schedule_inquiry':
        case 'availability_inquiry':
            activities = await searchActivities(classified.filters, classified.search_terms);
            break;

        case 'activity_details':
            if (classified.activity_name) {
                const single = await getActivityByName(classified.activity_name);
                if (single) {
                    activities = [single];
                } else {
                    activities = await searchActivities(classified.filters, classified.search_terms ?? [classified.activity_name]);
                }
            } else {
                activities = await searchActivities(classified.filters, classified.search_terms);
            }
            break;

        case 'search_events':
            events = await searchEvents(classified.filters, classified.search_terms);
            break;

        case 'general_info':
            const [acts, evs] = await Promise.all([
                searchActivities(classified.filters, classified.search_terms),
                getUpcomingEvents(30),
            ]);
            activities = acts;
            events = evs;
            break;
        
        // Greeting and Off-topic don't need DB retrieval
        default:
            break;
    }

    return { 
        searchResults: { activities, events } 
    };
}

/**
 * Node 3: Generate the final natural language response.
 */
async function generateNode(state: StateType) {
    const { message, classified, searchResults } = state;
    
    if (!classified) return { response: "מצטער, לא הבנתי את הבקשה." };

    // Quick handle for non-DB intents
    if (classified.intent === 'greeting') {
        return { response: "שלום! אני מתני, הסוכן החכם של המתנ\"ס. איך אוכל לעזור לך היום?" };
    }
    if (classified.intent === 'off_topic') {
        return { response: "אני כאן כדי לעזור בכל מה שקשור למתנ\"ס שלנו (חוגים, אירועים ורישום). יש משהו בתחומים האלו שאוכל לסייע בו?" };
    }

    const chatModel = getChatModel();
    const resultCount = searchResults.activities.length + searchResults.events.length;
    const hasResults = resultCount > 0;

    // Build context
    let dbContext = "";
    if (hasResults) {
        const parts: string[] = [];
        if (searchResults.activities.length > 0) parts.push(formatActivitiesForContext(searchResults.activities));
        if (searchResults.events.length > 0) parts.push(formatEventsForContext(searchResults.events));
        dbContext = parts.join("\n\n");
    }

    const contextPrompt = `${CHAT_SYSTEM_PROMPT}

## מצב הנתונים:
${hasResults 
    ? `נמצאו ${resultCount} תוצאות רלוונטיות.` 
    : `לא נמצאו תוצאות התואמות בדיוק לחיפוש.`}

## נתונים מהדאטהבייס:
${dbContext}

## הודעה מהמשתמש:
"${message}"

החזר תשובה ידידותית בעברית.`;

    try {
        const result = await chatModel.generateContent(contextPrompt);
        return { response: result.response.text() };
    } catch {
        return { error: "Generation failed" };
    }
}

// ─── Graph Construction ──────────────────────────────────

const workflow = new StateGraph(AgentState)
    .addNode("classify", classifyNode)
    .addNode("retrieve", retrieveNode)
    .addNode("generate", generateNode)
    .addEdge(START, "classify")
    .addEdge("classify", "retrieve")
    .addEdge("retrieve", "generate")
    .addEdge("generate", END);

// Export the compiled graph
export const chatGraph = workflow.compile();
