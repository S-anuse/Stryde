// E:\Stryde\constants\goalDetails.ts

// Define TypeScript interfaces for the goalDetails structure
interface DietPlan {
  breakfast: string;
  lunch: string;
  dinner: string;
  snacks: string;
  totalCalories: string;
}

interface ExercisePlan {
  activity: string;
  duration: string;
  caloriesBurned: string;
}

interface DailyPlan {
  day: number;
  diet: DietPlan;
  exercise: ExercisePlan;
}

interface Activities {
  running: string;
  cycling: string;
  swimming: string;
  hiit: string;
}

interface Nutrition {
  preworkout: string;
  postworkout: string;
  hydration: string;
}

interface Goal {
  title: string;
  description: string;
  disclaimer: string;
  diet?: {
    protein: string;
    carbs: string;
    fats: string;
    calories: string;
  };
  exercise?: {
    duration: string;
    frequency: string;
    type: string;
  };
  dailyPlan?: DailyPlan[];
  activities?: Activities;
  nutrition?: Nutrition;
}

interface GoalDetails {
  [key: string]: Goal;
}

export const goalDetails: GoalDetails = {
  '1': {
    title: 'Reduce 1 kg in 1 week',
    description:
      'This goal focuses on a balanced approach to lose 1 kg in one week through a calorie deficit, regular exercise, and hydration. Follow the tailored diet and exercise plan to achieve your goal.',
    diet: {
      protein: '100-120g daily',
      carbs: '100-130g daily',
      fats: '40-50g daily',
      calories: '1500-1800 kcal daily',
    },
    exercise: {
      duration: '45-60 min daily',
      frequency: '5-6 days per week',
      type: 'Combination of cardio and strength training',
    },
    disclaimer:
      'Consult a healthcare professional before starting any weight loss plan. Results may vary based on individual factors.',
    dailyPlan: [
      {
        day: 1,
        diet: {
          breakfast: 'Oatmeal with berries and chia seeds (300 kcal)',
          lunch: 'Grilled chicken salad with olive oil dressing (400 kcal)',
          dinner: 'Steamed fish with quinoa and broccoli (400 kcal)',
          snacks: 'Greek yogurt (100 kcal), almonds (100 kcal)',
          totalCalories: '1300 kcal',
        },
        exercise: {
          activity: '45 min HIIT workout (treadmill intervals, bodyweight circuits)',
          duration: '45 min',
          caloriesBurned: '400-500 kcal',
        },
      },
      {
        day: 2,
        diet: {
          breakfast: 'Greek yogurt parfait with granola (300 kcal)',
          lunch: 'Turkey wrap with whole-grain tortilla (400 kcal)',
          dinner: 'Tofu stir-fry with vegetables (400 kcal)',
          snacks: 'Apple slices with peanut butter (150 kcal)',
          totalCalories: '1250 kcal',
        },
        exercise: {
          activity: '60 min jogging or stationary bike',
          duration: '60 min',
          caloriesBurned: '450-550 kcal',
        },
      },
      {
        day: 3,
        diet: {
          breakfast: 'Smoothie with spinach, banana, and protein powder (300 kcal)',
          lunch: 'Quinoa bowl with chickpeas and avocado (450 kcal)',
          dinner: 'Grilled salmon with asparagus (400 kcal)',
          snacks: 'Carrot sticks with hummus (100 kcal)',
          totalCalories: '1250 kcal',
        },
        exercise: {
          activity: '45 min weightlifting (lower body) or cycling',
          duration: '45 min',
          caloriesBurned: '400-500 kcal',
        },
      },
      {
        day: 4,
        diet: {
          breakfast: 'Whole-grain toast with avocado and egg (350 kcal)',
          lunch: 'Lentil soup with side salad (400 kcal)',
          dinner: 'Chicken breast with sweet potato (400 kcal)',
          snacks: 'Mixed berries (100 kcal)',
          totalCalories: '1250 kcal',
        },
        exercise: {
          activity: '60 min outdoor HIIT or indoor rowing',
          duration: '60 min',
          caloriesBurned: '450-550 kcal',
        },
      },
      {
        day: 5,
        diet: {
          breakfast: 'Cottage cheese with pineapple (300 kcal)',
          lunch: 'Grilled shrimp salad with vinaigrette (400 kcal)',
          dinner: 'Vegetable curry with brown rice (400 kcal)',
          snacks: 'Celery with almond butter (150 kcal)',
          totalCalories: '1250 kcal',
        },
        exercise: {
          activity: '45 min cardio (elliptical or stairmaster) + core workout',
          duration: '45 min',
          caloriesBurned: '350-450 kcal',
        },
      },
      {
        day: 6,
        diet: {
          breakfast: 'Chia pudding with mango (300 kcal)',
          lunch: 'Turkey and veggie skewers (400 kcal)',
          dinner: 'Baked cod with zucchini noodles (400 kcal)',
          snacks: 'Handful of walnuts (150 kcal)',
          totalCalories: '1250 kcal',
        },
        exercise: {
          activity: '60 min full-body strength training or trail running',
          duration: '60 min',
          caloriesBurned: '450-550 kcal',
        },
      },
      {
        day: 7,
        diet: {
          breakfast: 'Protein pancakes with berries (350 kcal)',
          lunch: 'Grilled vegetable and hummus wrap (400 kcal)',
          dinner: 'Lean beef stir-fry with peppers (400 kcal)',
          snacks: 'Orange slices (100 kcal)',
          totalCalories: '1250 kcal',
        },
        exercise: {
          activity: '45 min circuit training (gym or outdoor)',
          duration: '45 min',
          caloriesBurned: '400-500 kcal',
        },
      },
    ],
  },
  '2': {
    title: 'Burn 500 calories daily',
    description:
      'This goal focuses on burning 500 calories daily through various exercises and activities. Consistent calorie burning helps with weight management, improved cardiovascular health, and increased energy levels.',
    activities: {
      running: '30-45 min at moderate pace',
      cycling: '45-60 min at medium intensity',
      swimming: '30-40 min freestyle',
      hiit: '20-25 min high-intensity workout',
    },
    nutrition: {
      preworkout: 'Light carbs 30-60 min before exercise',
      postworkout: 'Protein + carbs within 45 min after workout',
      hydration: 'At least 500ml before and during exercise',
    },
    disclaimer:
      'Always consult with a healthcare professional before starting any new exercise regimen. Listen to your body and adjust activities based on your fitness level and health condition.',
  },
};