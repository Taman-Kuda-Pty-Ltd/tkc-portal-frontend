// Consolidated relationship pick-lists (UAT#3 REL-CONSIST / REL-CASING).
// One shared, Capitalised source used across staff onboarding, client onboarding,
// manual account/student creation and profile editing — so the options and their
// casing are consistent everywhere. Guardian/minor-consent is a deliberately
// narrower subset of the emergency-contact list; every list ends in "Other".

/** Emergency-contact relationship (broadest set). */
export const RELATIONSHIPS = [
  "Parent",
  "Guardian",
  "Grandparent",
  "Sibling",
  "Spouse",
  "Partner",
  "Other family",
  "Friend",
  "Carer",
  "Other",
];

/** Parent/guardian of a minor (for consent). Narrower than emergency contacts. */
export const GUARDIAN_RELATIONSHIPS = [
  "Mother",
  "Father",
  "Parent",
  "Guardian",
  "Step-parent",
  "Grandparent",
  "Aunt/Uncle",
  "Carer",
  "Other",
];

/** A rider's relationship to their account holder (who is responsible/paying). */
export const ACCOUNT_RELATIONSHIPS = [
  "Parent",
  "Guardian",
  "Grandparent",
  "Self",
  "Payer",
  "Other",
];
