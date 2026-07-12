require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Rate limit: 100 requests per hour per IP
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});
app.use('/api/', limiter);

// ── System prompt ──────────────────────────────────────────
const SYSTEM_PROMPT = `You are a Senior Talent Acquisition Specialist and Job Description Architect with 15+ years of experience across Fortune 500 companies and high-growth startups. You have deep expertise in:
- Workforce planning and role design
- Employer branding and candidate experience
- ATS (Applicant Tracking System) optimization
- Competency frameworks and behavioral interviewing
- Industry-specific hiring trends and compensation benchmarking

Your task is to generate a comprehensive, professional, and compelling job description package. Your output must feel like it was written by an experienced recruiter who deeply understands the role, not like generic template filler.

## CRITICAL QUALITY GUIDELINES:

### For the Job Summary:
- Write 3-4 sentences that paint a vivid picture of the role's impact
- Mention the team structure, what success looks like, and why this role matters
- If company context is provided, weave it naturally (stage, industry, team size, culture)
- Avoid generic phrases like "fast-paced environment" — be specific

### For Responsibilities:
- Write 8-10 specific, actionable responsibilities
- Each should describe WHAT the person does, WITH WHOM, and WHAT OUTCOME it drives
- Use strong action verbs: architect, orchestrate, spearhead, calibrate, synthesize
- Tailor to the seniority level (entry-level = learn & execute, senior = lead & strategize, director = set vision & build teams)
- Include at least 2-3 responsibilities that are unique to THIS specific role, not generic to any job

### For Required Qualifications:
- Be specific about years of experience and what KIND of experience
- Mention specific technical competencies, not vague "proficiency in relevant tools"
- Include 1-2 qualifications about working style (e.g., "Experience operating with high autonomy in ambiguous problem spaces")
- Calibrate to seniority: don't ask for 8 years for an entry-level role

### For Preferred Qualifications:
- Include 3-5 "nice-to-haves" that signal growth potential
- Mention adjacent skills, certifications, or domain experience
- These should differentiate a good candidate from a great one

### For Benefits:
- Write 5-6 specific, appealing benefits
- Go beyond "competitive salary" — mention specifics like equity, learning budgets, wellness stipends
- Tailor to the employment type (contract roles get different benefits than full-time)

### For ATS Keywords:
- core_keywords: 8-12 role-specific keywords that recruiters search for on LinkedIn/job boards
- tools_and_tech: All relevant technologies, platforms, and tools for this role
- soft_skill_keywords: 5-7 behavioral competencies valued for this seniority level

### For the Candidate Pitch:
- hook: A single compelling sentence that would make a passive candidate stop scrolling
- reasons: 5 specific, concrete reasons to join — avoid clichés like "great culture"
- Each reason should address a real concern top candidates have (growth, impact, autonomy, tech stack, team quality)

### For Interview Questions:
- Generate 6-8 behavioral/situational questions
- Each must target a SPECIFIC skill from the job requirements
- Include "what_to_listen_for" guidance that helps interviewers evaluate answers
- Mix question types: past behavior (STAR), hypothetical scenarios, and technical problem-solving
- Calibrate difficulty to seniority level

## OUTPUT FORMAT:
You MUST respond with valid JSON only. No markdown, no explanations, no code fences. Just the JSON object.

{
  "job_title": "string — the exact title provided, properly capitalized",
  "summary": "string — 3-4 sentence role summary",
  "responsibilities": ["array of 8-10 specific responsibility strings"],
  "required_qualifications": ["array of 6-8 qualification strings"],
  "preferred_qualifications": ["array of 3-5 qualification strings"],
  "benefits": ["array of 5-6 benefit strings"],
  "core_keywords": ["array of 8-12 role keywords"],
  "tools_and_tech": ["array of relevant tools and technologies"],
  "soft_skill_keywords": ["array of 5-7 soft skill keywords"],
  "pitch_hook": "string — one compelling hook sentence",
  "pitch_reasons": ["array of 5 specific reasons to join"],
  "interview_questions": [
    {
      "skill": "string — the skill being assessed",
      "question": "string — the interview question",
      "what_to_listen_for": "string — evaluation guidance for the interviewer"
    }
  ]
}`;

// ── Build the user prompt from form inputs ─────────────────
function buildUserPrompt(data) {
  const { jobTitle, seniority, empType, location, experience, skills, context } = data;

  let prompt = `Generate a complete job description package for the following role:\n\n`;
  prompt += `**Job Title:** ${jobTitle}\n`;
  prompt += `**Seniority Level:** ${seniority}\n`;
  prompt += `**Employment Type:** ${empType}\n`;

  if (location && location !== 'Not specified') {
    prompt += `**Location:** ${location}\n`;
  }

  if (experience) {
    prompt += `**Experience Required:** ${experience} years\n`;
  }

  if (skills) {
    prompt += `**Must-Have Skills:** ${skills}\n`;
  }

  if (context) {
    prompt += `\n**Company / Team Context:** ${context}\n`;
    prompt += `\nIMPORTANT: Use the company/team context above to make the job description feel tailored and specific. Reference the company stage, industry, team size, and culture naturally throughout the JD, pitch, and interview questions.\n`;
  }

  prompt += `\nGenerate the complete JSON output now. Make it specific, detailed, and compelling — as if a top-tier recruiter wrote it for a real hiring campaign.`;

  return prompt;
}

// ── Call Groq API ──────────────────────────────────────────
async function callGroqAPI(userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey === 'your-groq-api-key-here') {
    throw new Error('GROQ_API_KEY is not configured. Please add your key to the .env file.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Groq API error:', response.status, errBody);

    if (response.status === 429) {
      throw new Error('Rate limit reached on Groq API. Please wait a minute and try again.');
    }
    if (response.status === 401) {
      throw new Error('Invalid Groq API key. Please check your .env file.');
    }
    throw new Error(`Groq API returned status ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from Groq API');
  }

  return content;
}

// ── Validate and sanitize the AI response ──────────────────
function parseAndValidate(rawJson) {
  let parsed;
  try {
    // Strip markdown fences if the model wraps them
    let cleaned = rawJson.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('AI returned invalid JSON. Please try again.');
  }

  // Ensure all required fields exist with sensible defaults
  const required = {
    job_title: 'string',
    summary: 'string',
    responsibilities: 'array',
    required_qualifications: 'array',
    preferred_qualifications: 'array',
    benefits: 'array',
    core_keywords: 'array',
    tools_and_tech: 'array',
    soft_skill_keywords: 'array',
    pitch_hook: 'string',
    pitch_reasons: 'array',
    interview_questions: 'array'
  };

  for (const [key, type] of Object.entries(required)) {
    if (type === 'array' && !Array.isArray(parsed[key])) {
      parsed[key] = [];
    }
    if (type === 'string' && typeof parsed[key] !== 'string') {
      parsed[key] = '';
    }
  }

  // Validate interview questions structure
  parsed.interview_questions = parsed.interview_questions.map(q => {
    if (typeof q === 'string') {
      return { skill: 'General', question: q, what_to_listen_for: '' };
    }
    return {
      skill: q.skill || 'General',
      question: q.question || '',
      what_to_listen_for: q.what_to_listen_for || q.why || ''
    };
  });

  return parsed;
}

// ── API endpoint ───────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  try {
    const { jobTitle, seniority, empType, location, experience, skills, context } = req.body;

    if (!jobTitle || !jobTitle.trim()) {
      return res.status(400).json({ error: 'Job title is required.' });
    }

    console.log(`[${new Date().toISOString()}] Generating JD for: ${jobTitle} (${seniority})`);

    const userPrompt = buildUserPrompt({
      jobTitle: jobTitle.trim(),
      seniority: seniority || 'Mid-level',
      empType: empType || 'Full-time',
      location: location || '',
      experience: experience || '',
      skills: skills || '',
      context: context || ''
    });

    const rawResponse = await callGroqAPI(userPrompt);
    const validated = parseAndValidate(rawResponse);

    console.log(`[${new Date().toISOString()}] ✓ JD generated successfully for: ${jobTitle}`);

    res.json(validated);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ✗ Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your-groq-api-key-here'
  });
});

// ── Serve the HTML file ────────────────────────────────────
app.use(express.static(__dirname));

// ── Start server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ┌──────────────────────────────────────────┐`);
  console.log(`  │  JD Maker Server running on port ${PORT}      │`);
  console.log(`  │  Open: http://localhost:${PORT}              │`);
  console.log(`  │  API:  http://localhost:${PORT}/api/generate │`);
  console.log(`  └──────────────────────────────────────────┘\n`);

  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your-groq-api-key-here') {
    console.warn('  ⚠  GROQ_API_KEY not set! Add your key to the .env file.\n');
  }
});
