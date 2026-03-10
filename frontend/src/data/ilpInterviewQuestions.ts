// ─── ILP Interview Question Definitions ──────────────────────────────────────
// Each vertical has 25 questions across 5 sections (A–E).
// answer types: 'number' | 'text' | 'textarea' | 'select' | 'yesno' | 'yesno_detail'
// yesno_detail = yes/no + conditional follow-up text field

export type ILPAnswerType =
  | 'number'
  | 'text'
  | 'textarea'
  | 'select'
  | 'yesno'
  | 'yesno_detail';

export interface ILPOption {
  value: string;
  label: string;
}

export interface ILPQuestion {
  id:          string;         // e.g. "A1", "B7"
  label:       string;
  type:        ILPAnswerType;
  options?:    ILPOption[];
  detailLabel?: string;        // for yesno_detail
  placeholder?: string;
  min?:        number;
  max?:        number;
  required?:   boolean;
}

export interface ILPSection {
  id:        string;          // 'A' – 'E'
  title:     string;
  subtitle:  string;
  questions: ILPQuestion[];
}

// ── FARMER ────────────────────────────────────────────────────────────────────

export const FARMER_SECTIONS: ILPSection[] = [
  {
    id: 'A', title: 'Background & Experience', subtitle: 'Owner / Character Assessment',
    questions: [
      { id: 'A1', label: 'How many years have you been farming professionally?', type: 'number', min: 0, max: 60, required: true },
      { id: 'A2', label: 'What type of farming is your primary activity?', type: 'select', options: [
        { value: 'CROP', label: 'Crop farming' },
        { value: 'LIVESTOCK', label: 'Livestock' },
        { value: 'MIXED', label: 'Mixed (crop + livestock)' },
        { value: 'HORTICULTURE', label: 'Horticulture' },
      ], required: true },
      { id: 'A3', label: 'Have you ever received a formal agricultural loan before?', type: 'yesno', required: true },
      { id: 'A4', label: 'If yes — did you repay on time?', type: 'select', options: [
        { value: 'ALWAYS', label: 'Always on time' },
        { value: 'MOSTLY', label: 'Mostly on time' },
        { value: 'PARTIALLY', label: 'Partially repaid' },
        { value: 'DEFAULTED', label: 'Defaulted' },
        { value: 'NA', label: 'N/A — no previous loan' },
      ] },
      { id: 'A5', label: 'Reference 1: Name & phone number', type: 'text', placeholder: 'Full name, 07XXXXXXXX', required: true },
      { id: 'A5b', label: 'Reference 2: Name & phone number', type: 'text', placeholder: 'Full name, 07XXXXXXXX' },
      { id: 'A6', label: 'What is your CRB status to your knowledge?', type: 'select', options: [
        { value: 'CLEAR', label: 'No issues / Clear' },
        { value: 'RESOLVED', label: 'Had a resolved issue' },
        { value: 'ACTIVE', label: 'Have an active listing' },
      ], required: true },
    ],
  },
  {
    id: 'B', title: 'Farm Profile', subtitle: 'Business Assessment',
    questions: [
      { id: 'B7',  label: 'Total size of your farm (acres)?', type: 'number', min: 0, max: 5000, required: true },
      { id: 'B8',  label: 'How many acres are actively cultivated?', type: 'number', min: 0, max: 5000 },
      { id: 'B9',  label: 'Primary crop?', type: 'text', placeholder: 'e.g. Maize, Tea, Tomatoes', required: true },
      { id: 'B10', label: 'Secondary crops (if any)?', type: 'text', placeholder: 'e.g. Beans, Kales' },
      { id: 'B11', label: 'How many planting seasons per year?', type: 'select', options: [
        { value: '1', label: '1 season' },
        { value: '2', label: '2 seasons' },
        { value: '3', label: '3+ seasons' },
      ], required: true },
      { id: 'B12', label: 'Where do you sell your produce?', type: 'select', options: [
        { value: 'SUBSISTENCE', label: 'Subsistence only (home consumption)' },
        { value: 'LOCAL_MARKET', label: 'Local market' },
        { value: 'COOPERATIVE', label: 'Cooperative / Farmer group' },
        { value: 'CONTRACT', label: 'Contract buyer (state buyer name in notes)' },
      ], required: true },
      { id: 'B13', label: 'How many Juhudi or MFI group loan cycles have you completed?', type: 'select', options: [
        { value: '0', label: '0 cycles' },
        { value: '1', label: '1 cycle' },
        { value: '2', label: '2 cycles' },
        { value: '3', label: '3 or more cycles' },
      ], required: true },
    ],
  },
  {
    id: 'C', title: 'Operational Risk', subtitle: 'Risk Assessment',
    questions: [
      { id: 'C14', label: 'Water / irrigation source?', type: 'select', options: [
        { value: 'RAIN_FED', label: 'Rain-fed only' },
        { value: 'MIXED', label: 'Mixed (rain + irrigation)' },
        { value: 'IRRIGATED', label: 'River / borehole irrigation' },
      ], required: true },
      { id: 'C15', label: 'Do you have on-farm storage (grain store, cold storage)?', type: 'yesno', required: true },
      { id: 'C16', label: 'Do you have crop or weather insurance?', type: 'yesno_detail', detailLabel: 'Insurance provider name', required: true },
      { id: 'C17', label: 'Do you have any off-farm income (salary, business, remittances)?', type: 'yesno_detail', detailLabel: 'Source and monthly amount (KES)', required: true },
      { id: 'C18', label: 'Have you experienced a major crop failure in the last 3 years?', type: 'yesno_detail', detailLabel: 'Cause and how you managed it', required: true },
    ],
  },
  {
    id: 'D', title: 'Cash Flow', subtitle: 'Financial Assessment',
    questions: [
      { id: 'D19', label: 'Gross farming income in the last 12 months (KES)?', type: 'number', min: 0, required: true },
      { id: 'D20', label: 'Monthly farming input costs — seed, fertiliser, labour, transport (KES)?', type: 'number', min: 0, required: true },
      { id: 'D21', label: 'Monthly household expenses (KES)?', type: 'number', min: 0, required: true },
      { id: 'D22', label: 'Do you have existing loan repayments?', type: 'yesno_detail', detailLabel: 'Monthly repayment amount (KES)', required: true },
    ],
  },
  {
    id: 'E', title: 'Loan Purpose & Collateral', subtitle: 'Purpose & Security',
    questions: [
      { id: 'E23', label: 'What specifically will you use this loan for? (minimum 30 words)', type: 'textarea', placeholder: 'Describe in detail how you plan to use the funds...', required: true },
      { id: 'E24', label: 'Do you have a title deed or long-term lease for your land?', type: 'yesno_detail', detailLabel: 'Document number', required: true },
      { id: 'E25', label: 'What collateral can you offer? (description + estimated value KES)', type: 'textarea', placeholder: 'e.g. Title deed + farm equipment worth KES 150,000', required: true },
    ],
  },
];

// ── LANDLORD ──────────────────────────────────────────────────────────────────

export const LANDLORD_SECTIONS: ILPSection[] = [
  {
    id: 'A', title: 'Background & Experience', subtitle: 'Owner / Character Assessment',
    questions: [
      { id: 'A1', label: 'How many years have you owned rental property?', type: 'number', min: 0, max: 60, required: true },
      { id: 'A2', label: 'How many properties do you currently own?', type: 'number', min: 1, max: 100, required: true },
      { id: 'A3', label: 'Have you previously taken a loan related to your property?', type: 'yesno', required: true },
      { id: 'A4', label: 'If yes — was it repaid on time?', type: 'select', options: [
        { value: 'FULLY', label: 'Fully on time' },
        { value: 'MOSTLY', label: 'Mostly on time' },
        { value: 'OUTSTANDING', label: 'Still outstanding' },
        { value: 'DEFAULTED', label: 'Defaulted' },
        { value: 'NA', label: 'N/A — no previous loan' },
      ] },
      { id: 'A5', label: 'Reference 1: Name & phone (tenant or business associate)', type: 'text', placeholder: 'Full name, 07XXXXXXXX', required: true },
      { id: 'A5b', label: 'Reference 2: Name & phone', type: 'text', placeholder: 'Full name, 07XXXXXXXX' },
      { id: 'A6', label: 'What is your CRB status?', type: 'select', options: [
        { value: 'CLEAR', label: 'Clear / No issues' },
        { value: 'RESOLVED', label: 'Resolved issue' },
        { value: 'ACTIVE', label: 'Active listing' },
      ], required: true },
    ],
  },
  {
    id: 'B', title: 'Property & Business', subtitle: 'Business Assessment',
    questions: [
      { id: 'B7',  label: 'Property address / location?', type: 'text', placeholder: 'Street, area, county', required: true },
      { id: 'B8',  label: 'Type of property?', type: 'select', options: [
        { value: 'RESIDENTIAL', label: 'Residential' },
        { value: 'COMMERCIAL', label: 'Commercial' },
        { value: 'MIXED', label: 'Mixed use' },
      ], required: true },
      { id: 'B9',  label: 'How many rentable units does the property have?', type: 'number', min: 1, max: 1000, required: true },
      { id: 'B10', label: 'How many units are currently occupied?', type: 'number', min: 0, max: 1000, required: true },
      { id: 'B11', label: 'Average monthly rent per unit (KES)?', type: 'number', min: 0, required: true },
      { id: 'B12', label: 'How long has your longest-standing tenant been renting?', type: 'text', placeholder: 'e.g. 3 years, 18 months' },
      { id: 'B13', label: 'Do you have a signed title deed in your name?', type: 'yesno_detail', detailLabel: 'Title deed number', required: true },
    ],
  },
  {
    id: 'C', title: 'Operational Risk', subtitle: 'Risk Assessment',
    questions: [
      { id: 'C14', label: 'Approximate age of the building (years)?', type: 'number', min: 0, max: 200, required: true },
      { id: 'C15', label: 'Current maintenance condition?', type: 'select', options: [
        { value: 'GOOD', label: 'Excellent / Good' },
        { value: 'FAIR', label: 'Fair' },
        { value: 'POOR', label: 'Needs major work' },
      ], required: true },
      { id: 'C16', label: 'Do you have building or property insurance?', type: 'yesno_detail', detailLabel: 'Insurer and annual premium (KES)', required: true },
      { id: 'C17', label: 'Is the property in an area with high tenant demand?', type: 'select', options: [
        { value: 'PRIME', label: 'Prime urban' },
        { value: 'GOOD', label: 'Good urban' },
        { value: 'AVERAGE', label: 'Peri-urban / town' },
        { value: 'POOR', label: 'Rural' },
      ], required: true },
      { id: 'C18', label: 'Are there any current tenant disputes or vacancies expected?', type: 'yesno_detail', detailLabel: 'Details', required: true },
    ],
  },
  {
    id: 'D', title: 'Cash Flow', subtitle: 'Financial Assessment',
    questions: [
      { id: 'D19', label: 'Total monthly rental income from ALL properties (KES)?', type: 'number', min: 0, required: true },
      { id: 'D20', label: 'Monthly property maintenance and rates cost (KES)?', type: 'number', min: 0, required: true },
      { id: 'D21', label: 'Personal / household monthly expenses (KES)?', type: 'number', min: 0, required: true },
      { id: 'D22', label: 'Do you have existing loan repayments?', type: 'yesno_detail', detailLabel: 'Monthly repayment total (KES)', required: true },
      { id: 'D23', label: 'Any other income source besides rent?', type: 'yesno_detail', detailLabel: 'Source and monthly amount (KES)' },
    ],
  },
  {
    id: 'E', title: 'Loan Purpose & Collateral', subtitle: 'Purpose & Security',
    questions: [
      { id: 'E24', label: 'What will you use this loan for?', type: 'select', options: [
        { value: 'CONSTRUCTION', label: 'Property construction' },
        { value: 'RENOVATION', label: 'Renovation / upgrade' },
        { value: 'PURCHASE', label: 'Purchase additional unit' },
        { value: 'WORKING_CAPITAL', label: 'Working capital for property' },
      ], required: true },
      { id: 'E24b', label: 'Explain your loan purpose in detail', type: 'textarea', placeholder: 'Describe the specific use of funds...', required: true },
      { id: 'E25', label: 'What collateral will you pledge? (title deed number + any secondary collateral)', type: 'textarea', placeholder: 'Title deed no. XXXXX, plus any additional security', required: true },
    ],
  },
];

// ── SHOP OWNER ────────────────────────────────────────────────────────────────

export const SHOP_OWNER_SECTIONS: ILPSection[] = [
  {
    id: 'A', title: 'Background & Experience', subtitle: 'Owner / Character Assessment',
    questions: [
      { id: 'A1', label: 'How many years have you been running this specific business?', type: 'number', min: 0, max: 60, required: true },
      { id: 'A2', label: 'What type of business do you operate?', type: 'select', options: [
        { value: 'GENERAL_RETAIL', label: 'General retail / duka' },
        { value: 'FOOD_GROCERY', label: 'Food & grocery' },
        { value: 'HARDWARE', label: 'Hardware' },
        { value: 'CLOTHING', label: 'Clothing / textiles' },
        { value: 'ELECTRONICS', label: 'Electronics' },
        { value: 'PHARMACY', label: 'Pharmacy' },
        { value: 'OTHER', label: 'Other' },
      ], required: true },
      { id: 'A3', label: 'Have you taken a business loan before?', type: 'yesno', required: true },
      { id: 'A4', label: 'If yes — was it repaid on time?', type: 'select', options: [
        { value: 'FULLY', label: 'Fully on time' },
        { value: 'MOSTLY', label: 'Mostly on time' },
        { value: 'PARTIALLY', label: 'Partially repaid' },
        { value: 'DEFAULTED', label: 'Defaulted' },
        { value: 'NA', label: 'N/A — no previous loan' },
      ] },
      { id: 'A5', label: 'Reference 1: Name & phone (not a relative, someone who knows the business)', type: 'text', placeholder: 'Full name, 07XXXXXXXX', required: true },
      { id: 'A5b', label: 'Reference 2: Name & phone', type: 'text', placeholder: 'Full name, 07XXXXXXXX' },
      { id: 'A6', label: 'What is your CRB status?', type: 'select', options: [
        { value: 'CLEAR', label: 'Clear / No issues' },
        { value: 'RESOLVED', label: 'Resolved issue' },
        { value: 'ACTIVE', label: 'Active listing' },
      ], required: true },
    ],
  },
  {
    id: 'B', title: 'Business Assessment', subtitle: 'Business Quality',
    questions: [
      { id: 'B7',  label: 'Where is your shop located?', type: 'text', placeholder: 'Physical address or market name', required: true },
      { id: 'B8',  label: 'Do you have a current business or trading licence?', type: 'yesno_detail', detailLabel: 'Licence number and expiry date', required: true },
      { id: 'B9',  label: 'How many years has this location been operating?', type: 'number', min: 0, max: 60, required: true },
      { id: 'B10', label: 'Estimated average daily sales (KES)?', type: 'number', min: 0, required: true },
      { id: 'B11', label: 'Approximate current value of your stock (KES)?', type: 'number', min: 0, required: true },
      { id: 'B12', label: 'Top 3 product categories?', type: 'text', placeholder: 'e.g. Sugar, flour, cooking oil' },
      { id: 'B13', label: 'Do you keep a sales record or cashbook?', type: 'yesno_detail', detailLabel: 'How do you keep records? (physical book, mobile app, spreadsheet)', required: true },
    ],
  },
  {
    id: 'C', title: 'Operational Risk', subtitle: 'Risk Assessment',
    questions: [
      { id: 'C14', label: 'How many direct competitors are within 500 metres?', type: 'select', options: [
        { value: '0', label: 'None' },
        { value: '2', label: '1–2' },
        { value: '5', label: '3–5' },
        { value: '6', label: 'More than 5' },
      ], required: true },
      { id: 'C15', label: 'How many suppliers do you buy from regularly?', type: 'number', min: 1, max: 100, required: true },
      { id: 'C16', label: 'Typical supplier credit arrangement?', type: 'select', options: [
        { value: 'CASH', label: 'Cash only' },
        { value: '7DAY', label: '7-day credit' },
        { value: '30DAY', label: '14–30 day credit' },
        { value: '30PLUS', label: '30+ day credit' },
      ] },
      { id: 'C17', label: 'Do you have business insurance (fire, theft, stock)?', type: 'yesno_detail', detailLabel: 'Insurer and annual premium (KES)', required: true },
      { id: 'C18', label: 'Has your shop experienced theft, fire, or other loss events in the last 2 years?', type: 'yesno_detail', detailLabel: 'Description of what happened' },
      { id: 'C19', label: 'How would you describe customer foot traffic?', type: 'select', options: [
        { value: 'VERY_HIGH', label: 'Very high' },
        { value: 'HIGH', label: 'High' },
        { value: 'MODERATE', label: 'Moderate' },
        { value: 'LOW', label: 'Low' },
      ], required: true },
    ],
  },
  {
    id: 'D', title: 'Cash Flow', subtitle: 'Financial Assessment',
    questions: [
      { id: 'D20', label: 'Estimated average monthly revenue (KES)?', type: 'number', min: 0, required: true },
      { id: 'D21', label: 'Monthly cost of goods — stock purchases (KES)?', type: 'number', min: 0, required: true },
      { id: 'D22', label: 'Monthly business operating costs — rent, electricity, staff (KES)?', type: 'number', min: 0, required: true },
      { id: 'D23', label: 'Personal / household monthly expenses (KES)?', type: 'number', min: 0, required: true },
      { id: 'D24', label: 'Do you have existing loan repayments?', type: 'yesno_detail', detailLabel: 'Monthly repayment total (KES)', required: true },
    ],
  },
  {
    id: 'E', title: 'Loan Purpose & Collateral', subtitle: 'Purpose & Security',
    questions: [
      { id: 'E25a', label: 'What will this loan be used for?', type: 'select', options: [
        { value: 'STOCK', label: 'Stock purchase' },
        { value: 'EQUIPMENT', label: 'Equipment' },
        { value: 'RENOVATION', label: 'Renovation / expansion' },
        { value: 'RENT_DEPOSIT', label: 'Rent deposit' },
        { value: 'WORKING_CAPITAL', label: 'Working capital' },
      ], required: true },
      { id: 'E25b', label: 'Describe your loan purpose in detail (minimum 30 words)', type: 'textarea', placeholder: 'Explain exactly how you plan to use the funds and how it will grow your business...', required: true },
      { id: 'E25c', label: 'What collateral will you offer? (description + estimated value KES)', type: 'textarea', placeholder: 'e.g. Stock valued at KES 200,000 + personal guarantor John Doe 0712345678', required: true },
    ],
  },
];

export function getSections(segment: 'FARMER' | 'LANDLORD' | 'SHOP_OWNER'): ILPSection[] {
  switch (segment) {
    case 'FARMER':     return FARMER_SECTIONS;
    case 'LANDLORD':   return LANDLORD_SECTIONS;
    case 'SHOP_OWNER': return SHOP_OWNER_SECTIONS;
  }
}

export const SEGMENT_LABELS: Record<string, string> = {
  FARMER:     'Farmer',
  LANDLORD:   'Landlord',
  SHOP_OWNER: 'Shop Owner',
};
