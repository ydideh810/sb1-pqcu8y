'use client';

import Dexie, { Table } from 'dexie';
import { Prompt, LicenseRecord } from './types';

// Default prompts that will be added when the database is created
const DEFAULT_PROMPTS: Prompt[] = [
  {
    id: '1',
    title: 'Cyberpunk Story Generator',
    content: 'Write a short story set in a cyberpunk world where AI and humans coexist. Include themes of technology dependence and moral ambiguity.',
    category: 'creative',
    tags: ['writing', 'cyberpunk', 'sci-fi'],
    userId: 'system',
    createdAt: Date.now(),
    upvotes: 5
  },
  {
    id: '2',
    title: 'Code Review Assistant',
    content: 'Review this code for potential security vulnerabilities, performance issues, and suggest improvements following best practices.',
    category: 'technical',
    tags: ['coding', 'security', 'review'],
    userId: 'system',
    createdAt: Date.now(),
    upvotes: 7
  },
  {
    id: '3',
    title: 'Startup Idea Generator',
    content: 'Generate innovative startup ideas combining AI and sustainable technology. Include market analysis and potential challenges.',
    category: 'brainstorming',
    tags: ['business', 'innovation', 'ai'],
    userId: 'system',
    createdAt: Date.now(),
    upvotes: 6
  },
  {
    id: '4',
    title: 'AI Ethics Debate',
    content: 'Engage in a philosophical debate about AI consciousness and rights from different perspectives: AI researcher, ethicist, and AI entity.',
    category: 'roleplay',
    tags: ['ethics', 'debate', 'ai'],
    userId: 'system',
    createdAt: Date.now(),
    upvotes: 8
  }
];

class NidamDatabase extends Dexie {
  prompts!: Table<Prompt>;
  licenses!: Table<LicenseRecord>;

  constructor() {
    super('NidamDB');
    
    this.version(1).stores({
      prompts: 'id, category, userId, createdAt, title',
      licenses: '++id, licenseKey, productId, timestamp'
    });

    // Add hook to populate default prompts
    this.prompts.hook('creating', function (primKey, obj, trans) {
      obj.createdAt = obj.createdAt || Date.now();
      obj.upvotes = obj.upvotes || 0;
      return obj;
    });
  }

  async initializeDefaultPrompts() {
    try {
      const count = await this.prompts.count();
      if (count === 0) {
        await this.prompts.bulkPut(DEFAULT_PROMPTS);
      }
    } catch (error) {
      console.error('Error initializing default prompts:', error);
    }
  }
}

// Singleton instance with lazy initialization
let dbInstance: NidamDatabase | null = null;

// Safe database initialization
const initDB = () => {
  try {
    if (typeof window === 'undefined') return null;
    if (!dbInstance) {
      dbInstance = new NidamDatabase();
      // Initialize default prompts when database is first created
      dbInstance.initializeDefaultPrompts();
    }
    return dbInstance;
  } catch (error) {
    console.error('Database initialization error:', error);
    return null;
  }
};

// Database operations wrapper with SSR safety
export const dbOperations = {
  async isLicenseUsed(licenseKey: string): Promise<boolean> {
    const db = initDB();
    if (!db) return false;
    try {
      const record = await db.licenses.where('licenseKey').equals(licenseKey).first();
      return !!record;
    } catch (error) {
      console.error('License check error:', error);
      return false;
    }
  },

  async saveLicense(record: Omit<LicenseRecord, 'id'>): Promise<void> {
    const db = initDB();
    if (!db) return;
    try {
      await db.licenses.add(record);
    } catch (error) {
      console.error('Save license error:', error);
      throw new Error('Failed to save license');
    }
  },

  async getLicenseHistory(): Promise<LicenseRecord[]> {
    const db = initDB();
    if (!db) return [];
    try {
      return await db.licenses.orderBy('timestamp').reverse().toArray();
    } catch (error) {
      console.error('Get license history error:', error);
      return [];
    }
  },

  async addPrompt(prompt: Omit<Prompt, 'id'>): Promise<string> {
    const db = initDB();
    if (!db) return '';
    try {
      const id = crypto.randomUUID();
      await db.prompts.put({ ...prompt, id });
      return id;
    } catch (error) {
      console.error('Add prompt error:', error);
      throw new Error('Failed to add prompt');
    }
  },

  async getPrompts(category?: string): Promise<Prompt[]> {
    const db = initDB();
    if (!db) return DEFAULT_PROMPTS;
    try {
      let prompts = await db.prompts.toArray();
      if (prompts.length === 0) {
        // If no prompts exist, return default prompts
        return DEFAULT_PROMPTS;
      }
      if (category && category !== 'all') {
        prompts = prompts.filter(p => p.category === category);
      }
      return prompts.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Get prompts error:', error);
      return DEFAULT_PROMPTS;
    }
  },

  async upvotePrompt(promptId: string): Promise<void> {
    const db = initDB();
    if (!db) return;
    try {
      const prompt = await db.prompts.get(promptId);
      if (prompt) {
        await db.prompts.update(promptId, {
          upvotes: (prompt.upvotes || 0) + 1
        });
      }
    } catch (error) {
      console.error('Upvote prompt error:', error);
      throw new Error('Failed to upvote prompt');
    }
  },

  async searchPrompts(query: string): Promise<Prompt[]> {
    const db = initDB();
    if (!db) return [];
    try {
      const prompts = await db.prompts.toArray();
      return prompts.filter(prompt => 
        prompt.title.toLowerCase().includes(query.toLowerCase()) ||
        prompt.content.toLowerCase().includes(query.toLowerCase()) ||
        prompt.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
    } catch (error) {
      console.error('Search prompts error:', error);
      return [];
    }
  }
};