// ─── Pre-Screening Interview Question Bank ────────────────────────────────────
// Bilingual: English (en) and Kenyan Swahili (sw)
// 8 sections · 28 questions · weighted scoring 1-5 per question
// Section weights: s1=1, s2=2, s3=3, s4=3, s5=3, s6=2, s7=2, s8=1

export interface InterviewQuestion {
  id: string;       // q1 … q28
  section: string;  // s1 … s8
  en: { question: string; purpose: string };
  sw: { question: string; purpose: string };
}

export interface InterviewSection {
  id: string;
  weight: number;
  en: { title: string };
  sw: { title: string };
  questions: InterviewQuestion[];
}

// ── Scoring guide labels ──────────────────────────────────────────────────────
export const SCORE_LABELS: Record<string, { en: string; sw: string }> = {
  '1': { en: 'Poor',        sw: 'Duni' },
  '2': { en: 'Below avg',   sw: 'Chini ya wastani' },
  '3': { en: 'Average',     sw: 'Wastani' },
  '4': { en: 'Good',        sw: 'Nzuri' },
  '5': { en: 'Excellent',   sw: 'Bora sana' },
};

// ── Recommendation labels ─────────────────────────────────────────────────────
export const RECOMMENDATION_LABELS: Record<string, { en: string; sw: string; color: string }> = {
  APPROVE:                 { en: 'Recommend Approval',       sw: 'Pendekeza Iidhinishwe',     color: 'green' },
  APPROVE_WITH_CONDITIONS: { en: 'Approve with Conditions',  sw: 'Idhinisha kwa Masharti',    color: 'yellow' },
  FURTHER_EVALUATION:      { en: 'Further Evaluation Needed',sw: 'Tathmini Zaidi Inahitajika',color: 'orange' },
  DECLINE:                 { en: 'Not Recommended',          sw: 'Haipendekezwi',             color: 'red' },
};

// ─── Sections & Questions ─────────────────────────────────────────────────────

export const INTERVIEW_SECTIONS: InterviewSection[] = [
  {
    id: 's1', weight: 1,
    en: { title: 'Personal & Background Information' },
    sw: { title: 'Maelezo ya Kibinafsi na Historia' },
    questions: [
      {
        id: 'q1', section: 's1',
        en: {
          question: 'Please introduce yourself and tell us a bit about your background.',
          purpose:  'Establish rapport and gather general personal history.',
        },
        sw: {
          question: 'Tafadhali jitambulishe na utuambie kidogo kuhusu historia yako.',
          purpose:  'Kuanzisha mazungumzo na kukusanya taarifa za jumla za kibinafsi.',
        },
      },
      {
        id: 'q2', section: 's1',
        en: {
          question: 'How long have you lived in your current community, and what is your role within it?',
          purpose:  'Assess stability and community ties — indicators of reliability.',
        },
        sw: {
          question: 'Umekuwa ukiishi katika jamii yako ya sasa kwa muda gani, na una jukumu gani ndani yake?',
          purpose:  'Kutathmini utulivu na uhusiano na jamii — viashiria vya uaminifu.',
        },
      },
      {
        id: 'q3', section: 's1',
        en: {
          question: "Can you describe your family's involvement in your farming activities?",
          purpose:  'Understand family support and potential labour resources.',
        },
        sw: {
          question: 'Je, unaweza kuelezea jinsi familia yako inavyoshiriki katika shughuli zako za kilimo?',
          purpose:  'Kuelewa msaada wa familia na rasilimali za kazi.',
        },
      },
    ],
  },
  {
    id: 's2', weight: 2,
    en: { title: 'Farming Activities & Experience' },
    sw: { title: 'Shughuli za Kilimo na Uzoefu' },
    questions: [
      {
        id: 'q4', section: 's2',
        en: {
          question: 'What type of farming do you engage in, and how many years of experience do you have?',
          purpose:  'Evaluate experience level and expertise.',
        },
        sw: {
          question: 'Unafanya aina gani ya kilimo, na una uzoefu wa miaka mingapi?',
          purpose:  'Kutathmini uzoefu na ujuzi katika kilimo.',
        },
      },
      {
        id: 'q5', section: 's2',
        en: {
          question: 'Can you walk us through a typical farming season? What crops do you plant and when?',
          purpose:  'Assess planning skills and understanding of agricultural cycles.',
        },
        sw: {
          question: 'Je, unaweza kuelezea msimu wa kawaida wa kilimo kwako? Unapanda mazao gani, na lini?',
          purpose:  'Kutathmini ujuzi wa kupanga na kuelewa mzunguko wa kilimo.',
        },
      },
      {
        id: 'q6', section: 's2',
        en: {
          question: 'How do you decide which crops to plant each season?',
          purpose:  'Gauge decision-making and market awareness.',
        },
        sw: {
          question: 'Unaamuaje mazao gani kupanda kila msimu?',
          purpose:  'Kupima uamuzi na ufahamu wa soko.',
        },
      },
      {
        id: 'q7', section: 's2',
        en: {
          question: 'What challenges have you faced in your farming activities, and how have you overcome them?',
          purpose:  'Assess problem-solving skills and resilience.',
        },
        sw: {
          question: 'Ni changamoto gani umekutana nazo katika shughuli zako za kilimo, na umezishinda vipi?',
          purpose:  'Kutathmini ujuzi wa kutatua matatizo na ustahimilivu.',
        },
      },
    ],
  },
  {
    id: 's3', weight: 3,
    en: { title: 'Financial Practices & Literacy' },
    sw: { title: 'Mazoea ya Kifedha na Elimu ya Fedha' },
    questions: [
      {
        id: 'q8', section: 's3',
        en: {
          question: 'How do you keep track of your farming income and expenses?',
          purpose:  'Evaluate record-keeping habits and financial management skills.',
        },
        sw: {
          question: 'Unafuatiliaje mapato na matumizi yako ya kilimo?',
          purpose:  'Kutathmini mazoea ya kurekodi na ujuzi wa kusimamia fedha.',
        },
      },
      {
        id: 'q9', section: 's3',
        en: {
          question: 'Can you explain the difference between profit and cash flow?',
          purpose:  'Assess understanding of basic financial concepts.',
        },
        sw: {
          question: 'Unaweza kueleza tofauti kati ya faida na mtiririko wa pesa?',
          purpose:  'Kutathmini uelewa wa dhana za msingi za fedha.',
        },
      },
      {
        id: 'q10', section: 's3',
        en: {
          question: 'What strategies do you use to budget for both your household and farming needs?',
          purpose:  'Determine budgeting skills and financial planning ability.',
        },
        sw: {
          question: 'Unatumia mikakati gani ya kupanga bajeti kwa mahitaji ya nyumbani na kilimo?',
          purpose:  'Kuamua ujuzi wa bajeti na uwezo wa kupanga kifedha.',
        },
      },
      {
        id: 'q11', section: 's3',
        en: {
          question: 'Have you ever taken a loan before? If so, how did you manage the repayments?',
          purpose:  'Understand past borrowing experience and repayment history.',
        },
        sw: {
          question: 'Je, umewahi kuchukua mkopo hapo awali? Kama ndiyo, ulisimamia vipi malipo?',
          purpose:  'Kuelewa uzoefu wa kukopa hapo awali na historia ya malipo.',
        },
      },
      {
        id: 'q12', section: 's3',
        en: {
          question: "What does the term 'interest rate' mean to you, and how does it affect your loan repayments?",
          purpose:  'Assess knowledge of loan terms and cost of borrowing.',
        },
        sw: {
          question: 'Neno "kiwango cha riba" linamaanisha nini kwako, na linaathiri vipi malipo ya mkopo wako?',
          purpose:  'Kutathmini maarifa ya masharti ya mkopo na gharama ya kukopa.',
        },
      },
      {
        id: 'q13', section: 's3',
        en: {
          question: "Can you describe what collateral is and why it's important in lending?",
          purpose:  'Evaluate understanding of loan security requirements.',
        },
        sw: {
          question: 'Unaweza kuelezea dhamana ni nini na kwa nini ni muhimu katika ukopeshaji?',
          purpose:  'Kutathmini uelewa wa mahitaji ya usalama wa mkopo.',
        },
      },
    ],
  },
  {
    id: 's4', weight: 3,
    en: { title: 'Loan Purpose & Repayment Plan' },
    sw: { title: 'Madhumuni ya Mkopo na Mpango wa Kulipa' },
    questions: [
      {
        id: 'q14', section: 's4',
        en: {
          question: 'What is the specific purpose of the loan you are requesting?',
          purpose:  'Ensure the loan will be used for productive purposes.',
        },
        sw: {
          question: 'Mkopo unaoomba ni kwa madhumuni gani hasa?',
          purpose:  'Kuhakikisha mkopo utatumika kwa madhumuni ya uzalishaji.',
        },
      },
      {
        id: 'q15', section: 's4',
        en: {
          question: 'How will this loan improve your farming activities or income?',
          purpose:  'Assess the potential impact and viability of the investment.',
        },
        sw: {
          question: 'Mkopo huu utaboresha vipi shughuli zako za kilimo au mapato yako?',
          purpose:  'Kutathmini athari inayowezekana na uwezekano wa uwekezaji.',
        },
      },
      {
        id: 'q16', section: 's4',
        en: {
          question: 'Do you have a repayment plan in mind? Can you explain how you intend to repay the loan?',
          purpose:  'Evaluate foresight and commitment to repayment.',
        },
        sw: {
          question: 'Je, una mpango wa kulipa akilini? Unaweza kueleza jinsi unavyokusudia kulipa mkopo?',
          purpose:  'Kutathmini uangalifu na kujitolea kwa kulipa.',
        },
      },
      {
        id: 'q17', section: 's4',
        en: {
          question: "Are there other income sources you can rely on to repay the loan if your primary plan doesn't work out?",
          purpose:  "Identify secondary repayment sources and risk mitigation.",
        },
        sw: {
          question: 'Je, kuna vyanzo vingine vya mapato unavyoweza kutegemea kulipa mkopo ikiwa mpango wako wa msingi hautafanikiwa?',
          purpose:  'Kutambua vyanzo vya ziada vya malipo na kupunguza hatari.',
        },
      },
    ],
  },
  {
    id: 's5', weight: 3,
    en: { title: 'Character Assessment' },
    sw: { title: 'Tathmini ya Tabia' },
    questions: [
      {
        id: 'q18', section: 's5',
        en: {
          question: 'How do you handle financial obligations when unexpected events occur, such as crop failure or medical emergencies?',
          purpose:  'Assess responsibility and prioritisation of debts.',
        },
        sw: {
          question: 'Unashughalikia vipi majukumu ya kifedha yanapotokea matukio yasiyotarajiwa, kama vile kushindwa kwa mazao au dharura za kiafya?',
          purpose:  'Kutathmini uwajibikaji na kipaumbele cha madeni.',
        },
      },
      {
        id: 'q19', section: 's5',
        en: {
          question: "Can you give examples of how you've honoured past commitments — financial or otherwise?",
          purpose:  'Evaluate trustworthiness and reliability through concrete examples.',
        },
        sw: {
          question: 'Je, unaweza kutoa mifano ya jinsi unavyoheshimu ahadi za zamani — za kifedha au vinginevyo?',
          purpose:  'Kutathmini uaminifu na utegemezi kupitia mifano halisi.',
        },
      },
      {
        id: 'q20', section: 's5',
        en: {
          question: "Why do you believe it's important to repay loans on time?",
          purpose:  'Gauge attitudes toward debt and ethical considerations.',
        },
        sw: {
          question: 'Kwa nini unaamini ni muhimu kulipa mikopo kwa wakati?',
          purpose:  'Kupima mitazamo kuhusu deni na maadili.',
        },
      },
      {
        id: 'q21', section: 's5',
        en: {
          question: 'Would you be willing to have community members or group leaders vouch for your character?',
          purpose:  'Assess openness to external validation and community standing.',
        },
        sw: {
          question: 'Je, ungekubali kuwa na wanajamii au viongozi wa kikundi wanaokuhakikishia tabia yako na uaminifu?',
          purpose:  'Kutathmini uwazi kwa uthibitisho wa nje na hadhi ya jamii.',
        },
      },
    ],
  },
  {
    id: 's6', weight: 2,
    en: { title: 'Understanding of Risks & Responsibilities' },
    sw: { title: 'Uelewa wa Hatari na Majukumu' },
    questions: [
      {
        id: 'q22', section: 's6',
        en: {
          question: 'What risks do you foresee in taking this loan, and how do you plan to manage them?',
          purpose:  'Assess risk awareness and contingency planning.',
        },
        sw: {
          question: 'Ni hatari gani unazotarajia katika kuchukua mkopo huu, na unaplani kuzisimamia vipi?',
          purpose:  'Kutathmini ufahamu wa hatari na mipango ya dharura.',
        },
      },
      {
        id: 'q23', section: 's6',
        en: {
          question: 'Are you aware of the consequences of defaulting on a loan? Can you explain them?',
          purpose:  'Ensure understanding of obligations and repercussions.',
        },
        sw: {
          question: 'Je, unajua matokeo ya kushindwa kulipa mkopo na taasisi yetu? Unaweza kuyaeleza?',
          purpose:  'Kuhakikisha uelewa wa majukumu na matokeo.',
        },
      },
      {
        id: 'q24', section: 's6',
        en: {
          question: 'How do you think taking this loan will affect your relationship with the community and our institution?',
          purpose:  'Evaluate perception of social and relational impacts.',
        },
        sw: {
          question: 'Unafikiria kuchukua mkopo huu kutaathiri vipi uhusiano wako na jamii na taasisi yetu?',
          purpose:  'Kutathmini mtazamo wa athari za kijamii na mahusiano.',
        },
      },
    ],
  },
  {
    id: 's7', weight: 2,
    en: { title: 'Commitment & Future Plans' },
    sw: { title: 'Kujitolea na Mipango ya Baadaye' },
    questions: [
      {
        id: 'q25', section: 's7',
        en: {
          question: 'Where do you see your farming business in the next 2–3 years?',
          purpose:  'Assess long-term planning and ambition.',
        },
        sw: {
          question: 'Unaona biashara yako ya kilimo iko wapi katika miaka 2–3 ijayo?',
          purpose:  'Kutathmini mipango ya muda mrefu na tamaa.',
        },
      },
      {
        id: 'q26', section: 's7',
        en: {
          question: 'How can our institution support you beyond providing this loan?',
          purpose:  'Identify opportunities for additional services and strengthen the relationship.',
        },
        sw: {
          question: 'Taasisi yetu inaweza kukusaidia vipi zaidi ya kutoa mkopo huu?',
          purpose:  'Kutambua fursa za huduma za ziada na kuimarisha uhusiano.',
        },
      },
    ],
  },
  {
    id: 's8', weight: 1,
    en: { title: 'Final Thoughts' },
    sw: { title: 'Mawazo ya Mwisho' },
    questions: [
      {
        id: 'q27', section: 's8',
        en: {
          question: 'Do you have any questions for us about the loan process or our institution?',
          purpose:  'Encourage open communication and clarify any misunderstandings.',
        },
        sw: {
          question: 'Je, una maswali yoyote kwetu kuhusu mchakato wa mkopo au taasisi yetu?',
          purpose:  'Kuhimiza mawasiliano wazi na kufafanua kutoelewana.',
        },
      },
      {
        id: 'q28', section: 's8',
        en: {
          question: "Is there anything else you'd like to share that would help us understand your situation better?",
          purpose:  'Allow the customer to provide additional relevant context.',
        },
        sw: {
          question: 'Je, kuna kitu kingine ungependa kushiriki ambacho kingetusaidia kuelewa hali yako vizuri zaidi?',
          purpose:  'Kumruhusu mteja kutoa taarifa za ziada muhimu.',
        },
      },
    ],
  },
];

// ── Flat question lookup ──────────────────────────────────────────────────────
export const QUESTION_MAP: Record<string, InterviewQuestion> = {};
for (const section of INTERVIEW_SECTIONS) {
  for (const q of section.questions) {
    QUESTION_MAP[q.id] = q;
  }
}

// ── Max possible score ────────────────────────────────────────────────────────
export const MAX_SCORE = INTERVIEW_SECTIONS.reduce(
  (sum, s) => sum + s.questions.length * 5 * s.weight, 0,
);

// ── Red flag categories (for LO guidance panel) ───────────────────────────────
export const RED_FLAGS: Record<string, { en: string; sw: string }> = {
  inconsistent:  { en: 'Inconsistent answers about income, expenses, or plans', sw: 'Majibu yanayopingana kuhusu mapato, matumizi, au mipango' },
  no_plan:       { en: 'No clear idea of how the loan will be used or repaid',  sw: 'Hakuna wazo wazi la jinsi mkopo utakavyotumika au kulipwa' },
  evasive:       { en: 'Evasive when asked about past debts or obligations',     sw: 'Kukwepa maswali kuhusu madeni ya zamani au majukumu' },
  unrealistic:   { en: 'Overly optimistic projections without evidence',         sw: 'Matarajio makubwa sana bila ushahidi' },
  poor_community:{ en: 'Negative community feedback or poor reputation',         sw: 'Maoni mabaya ya jamii au sifa mbaya' },
};
