import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'e2e',timeout:45000,expect:{timeout:15000},fullyParallel:false,workers:1,use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1536,height:1024},trace:'retain-on-failure'},webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:true,timeout:60000}});
