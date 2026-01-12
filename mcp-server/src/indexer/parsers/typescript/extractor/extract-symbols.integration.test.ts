/**
 * Integration Tests - Real-World Pattern Compatibility
 *
 * These tests verify the TypeScript parser correctly handles common patterns
 * from popular frameworks and Node.js applications.
 *
 * Note: These tests validate current parser capabilities. Some features like
 * constructor extraction and isStatic on properties are not yet implemented.
 */

import { describe, it, expect } from 'vitest';
import { parseTypeScript } from '../parser.js';
import { extractSymbols } from './extract-symbols.js';

describe('extractSymbols - Integration Tests', () => {
  describe('NestJS patterns', () => {
    it('should extract controller with class and method decorators', () => {
      // Note: Using non-exported class because decorators on exported classes
      // are not yet supported (they appear as siblings of export_statement)
      const source = `
        @Controller('users')
        @Injectable()
        class UsersController {
          @Get(':id')
          async findOne(@Param('id') id: string): Promise<User> {
            return this.usersService.findById(id);
          }

          @Post()
          @HttpCode(201)
          create(@Body() dto: CreateUserDto): Promise<User> {
            return this.usersService.create(dto);
          }
        }
      `;
      const tree = parseTypeScript(source, '/src/users/users.controller.ts');
      const result = extractSymbols(tree, '/src/users/users.controller.ts');

      // Class extraction
      expect(result.classes).toHaveLength(1);
      const controller = result.classes[0]!;
      expect(controller.name).toBe('UsersController');
      expect(controller.kind).toBe('class');

      // Class decorators
      expect(controller.annotations).toHaveLength(2);
      expect(controller.annotations.map((a) => a.name)).toContain('Controller');
      expect(controller.annotations.map((a) => a.name)).toContain('Injectable');

      // Methods
      expect(controller.functions).toHaveLength(2);

      // findOne method
      const findOne = controller.functions.find((f) => f.name === 'findOne');
      expect(findOne).toBeDefined();
      expect(findOne!.isSuspend).toBe(true); // async
      expect(findOne!.annotations.map((a) => a.name)).toContain('Get');
      expect(findOne!.returnType).toBe('Promise<User>');

      // create method
      const create = controller.functions.find((f) => f.name === 'create');
      expect(create).toBeDefined();
      expect(create!.annotations).toHaveLength(2);
      expect(create!.annotations.map((a) => a.name)).toContain('Post');
      expect(create!.annotations.map((a) => a.name)).toContain('HttpCode');
    });

    it('should extract service with async methods', () => {
      const source = `
        @Injectable()
        class UserService {
          async findAll(): Promise<User[]> {
            return this.userRepo.find();
          }

          async create(dto: CreateUserDto): Promise<User> {
            const user = new User(dto);
            return this.userRepo.save(user);
          }
        }
      `;
      const tree = parseTypeScript(source, '/src/users/user.service.ts');
      const result = extractSymbols(tree, '/src/users/user.service.ts');

      const service = result.classes[0]!;
      expect(service.name).toBe('UserService');
      expect(service.annotations[0]!.name).toBe('Injectable');

      // Async methods
      expect(service.functions).toHaveLength(2);
      expect(service.functions[0]!.isSuspend).toBe(true);
      expect(service.functions[1]!.isSuspend).toBe(true);
      expect(service.functions[0]!.returnType).toBe('Promise<User[]>');
      expect(service.functions[1]!.returnType).toBe('Promise<User>');
    });

    it('should extract module with decorator arguments', () => {
      const source = `
        @Module({
          imports: [DatabaseModule, ConfigModule],
          controllers: [UsersController],
          providers: [UserService, UserRepository],
          exports: [UserService],
        })
        class UsersModule {}
      `;
      const tree = parseTypeScript(source, '/src/users/users.module.ts');
      const result = extractSymbols(tree, '/src/users/users.module.ts');

      const module = result.classes[0]!;
      expect(module.name).toBe('UsersModule');
      expect(module.annotations).toHaveLength(1);
      expect(module.annotations[0]!.name).toBe('Module');
      expect(module.annotations[0]!.arguments).toBeDefined();
    });

    it('should extract DTO with validation decorators', () => {
      const source = `
        export class CreateUserDto {
          @IsString()
          @MinLength(2)
          @MaxLength(50)
          readonly name: string;

          @IsEmail()
          @IsNotEmpty()
          readonly email: string;

          @IsOptional()
          @IsNumber()
          readonly age?: number;
        }
      `;
      const tree = parseTypeScript(source, '/src/users/dto/create-user.dto.ts');
      const result = extractSymbols(tree, '/src/users/dto/create-user.dto.ts');

      const dto = result.classes[0]!;
      expect(dto.name).toBe('CreateUserDto');

      // Properties with decorators
      expect(dto.properties).toHaveLength(3);

      const nameProp = dto.properties.find((p) => p.name === 'name');
      expect(nameProp).toBeDefined();
      expect(nameProp!.annotations).toHaveLength(3);
      expect(nameProp!.annotations.map((a) => a.name)).toContain('IsString');

      const emailProp = dto.properties.find((p) => p.name === 'email');
      expect(emailProp).toBeDefined();
      expect(emailProp!.annotations.map((a) => a.name)).toContain('IsEmail');

      const ageProp = dto.properties.find((p) => p.name === 'age');
      expect(ageProp).toBeDefined();
      expect(ageProp!.annotations.map((a) => a.name)).toContain('IsOptional');
    });

    it('should extract entity with TypeORM decorators', () => {
      const source = `
        @Entity('users')
        class User {
          @PrimaryGeneratedColumn('uuid')
          id: string;

          @Column({ type: 'varchar', length: 255 })
          name: string;

          @Column({ unique: true })
          email: string;

          @CreateDateColumn()
          createdAt: Date;

          @OneToMany(() => Post, post => post.author)
          posts: Post[];
        }
      `;
      const tree = parseTypeScript(source, '/src/entities/user.entity.ts');
      const result = extractSymbols(tree, '/src/entities/user.entity.ts');

      const entity = result.classes[0]!;
      expect(entity.name).toBe('User');
      expect(entity.annotations[0]!.name).toBe('Entity');

      // All properties extracted
      expect(entity.properties).toHaveLength(5);
      expect(entity.properties.map((p) => p.name)).toEqual(['id', 'name', 'email', 'createdAt', 'posts']);

      // Property decorators
      const idProp = entity.properties.find((p) => p.name === 'id');
      expect(idProp!.annotations.map((a) => a.name)).toContain('PrimaryGeneratedColumn');

      const postsProp = entity.properties.find((p) => p.name === 'posts');
      expect(postsProp!.annotations.map((a) => a.name)).toContain('OneToMany');

      // Types
      expect(idProp!.type).toBe('string');
      expect(postsProp!.type).toBe('Post[]');
    });
  });

  describe('React patterns', () => {
    it('should extract functional component with hooks', () => {
      const source = `
        import React, { useState, useEffect } from 'react';

        interface Props {
          title: string;
          onClose: () => void;
        }

        export const Modal: React.FC<Props> = ({ title, onClose }) => {
          const [isOpen, setIsOpen] = useState(true);

          useEffect(() => {
            document.title = title;
          }, [title]);

          return <div onClick={onClose}>{title}</div>;
        };
      `;
      const tree = parseTypeScript(source, '/src/components/Modal.tsx');
      const result = extractSymbols(tree, '/src/components/Modal.tsx');

      // Imports
      expect(result.imports).toHaveLength(3);
      expect(result.imports.map((i) => i.name)).toContain('React');
      expect(result.imports.map((i) => i.name)).toContain('useState');
      expect(result.imports.map((i) => i.name)).toContain('useEffect');

      // Interface Props
      const propsInterface = result.classes.find((c) => c.name === 'Props');
      expect(propsInterface).toBeDefined();
      expect(propsInterface!.kind).toBe('interface');
      expect(propsInterface!.properties).toHaveLength(2);

      // Modal component (arrow function)
      expect(result.topLevelFunctions).toHaveLength(1);
      const modal = result.topLevelFunctions[0]!;
      expect(modal.name).toBe('Modal');

      // Hook calls extracted
      expect(modal.calls).toBeDefined();
      expect(modal.calls!.map((c) => c.name)).toContain('useState');
      expect(modal.calls!.map((c) => c.name)).toContain('useEffect');
    });

    it('should extract custom hook', () => {
      const source = `
        import { useState, useCallback } from 'react';

        interface UseCounterReturn {
          count: number;
          increment: () => void;
          decrement: () => void;
          reset: () => void;
        }

        export function useCounter(initialValue: number = 0): UseCounterReturn {
          const [count, setCount] = useState(initialValue);

          const increment = useCallback(() => setCount(c => c + 1), []);
          const decrement = useCallback(() => setCount(c => c - 1), []);
          const reset = useCallback(() => setCount(initialValue), [initialValue]);

          return { count, increment, decrement, reset };
        }
      `;
      const tree = parseTypeScript(source, '/src/hooks/useCounter.ts');
      const result = extractSymbols(tree, '/src/hooks/useCounter.ts');

      // Interface
      const returnInterface = result.classes.find((c) => c.name === 'UseCounterReturn');
      expect(returnInterface).toBeDefined();
      expect(returnInterface!.properties).toHaveLength(4);

      // Hook function
      const hook = result.topLevelFunctions[0]!;
      expect(hook.name).toBe('useCounter');
      expect(hook.returnType).toBe('UseCounterReturn');
      expect(hook.parameters).toHaveLength(1);
      expect(hook.parameters[0]!.name).toBe('initialValue');
      expect(hook.parameters[0]!.defaultValue).toBe('0');
    });

    it('should extract component with forwardRef and generics', () => {
      const source = `
        import React, { forwardRef, useImperativeHandle, useRef } from 'react';

        export interface InputRef {
          focus(): void;
          getValue(): string;
        }

        interface InputProps {
          label: string;
          placeholder?: string;
        }

        // forwardRef returns a component, stored as a variable (not an arrow function)
        export const Input = forwardRef<InputRef, InputProps>(
          ({ label, placeholder }, ref) => {
            const inputRef = useRef<HTMLInputElement>(null);
            return <input ref={inputRef} placeholder={placeholder} />;
          }
        );
      `;
      const tree = parseTypeScript(source, '/src/components/Input.tsx');
      const result = extractSymbols(tree, '/src/components/Input.tsx');

      // InputRef interface with method signatures
      const inputRef = result.classes.find((c) => c.name === 'InputRef');
      expect(inputRef).toBeDefined();
      expect(inputRef!.kind).toBe('interface');
      expect(inputRef!.functions).toHaveLength(2);
      expect(inputRef!.functions.map((f) => f.name)).toContain('focus');
      expect(inputRef!.functions.map((f) => f.name)).toContain('getValue');

      // InputProps interface
      const inputProps = result.classes.find((c) => c.name === 'InputProps');
      expect(inputProps).toBeDefined();
      expect(inputProps!.properties).toHaveLength(2);

      // Input is stored as a property (result of forwardRef call, not an arrow function)
      expect(result.topLevelProperties.map((p) => p.name)).toContain('Input');
    });

    it('should extract context provider pattern', () => {
      const source = `
        import { createContext, useContext, useState, ReactNode } from 'react';

        interface ThemeContextType {
          theme: 'light' | 'dark';
          toggleTheme: () => void;
        }

        const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

        export function ThemeProvider({ children }: { children: ReactNode }) {
          const [theme, setTheme] = useState<'light' | 'dark'>('light');

          const toggleTheme = () => {
            setTheme(prev => prev === 'light' ? 'dark' : 'light');
          };

          return (
            <ThemeContext.Provider value={{ theme, toggleTheme }}>
              {children}
            </ThemeContext.Provider>
          );
        }

        export function useTheme(): ThemeContextType {
          const context = useContext(ThemeContext);
          if (!context) {
            throw new Error('useTheme must be used within a ThemeProvider');
          }
          return context;
        }
      `;
      const tree = parseTypeScript(source, '/src/contexts/ThemeContext.tsx');
      const result = extractSymbols(tree, '/src/contexts/ThemeContext.tsx');

      // Interface
      const themeContextType = result.classes.find((c) => c.name === 'ThemeContextType');
      expect(themeContextType).toBeDefined();

      // ThemeContext variable (createContext call)
      expect(result.topLevelProperties.map((p) => p.name)).toContain('ThemeContext');

      // Functions
      expect(result.topLevelFunctions).toHaveLength(2);
      expect(result.topLevelFunctions.map((f) => f.name)).toContain('ThemeProvider');
      expect(result.topLevelFunctions.map((f) => f.name)).toContain('useTheme');
    });

    it('should extract higher-order component', () => {
      const source = `
        import React, { ComponentType } from 'react';

        interface WithLoadingProps {
          isLoading: boolean;
        }

        export function withLoading<P extends object>(
          WrappedComponent: ComponentType<P>
        ): ComponentType<P & WithLoadingProps> {
          return function WithLoadingComponent({ isLoading, ...props }: P & WithLoadingProps) {
            if (isLoading) {
              return <div>Loading...</div>;
            }
            return <WrappedComponent {...(props as P)} />;
          };
        }
      `;
      const tree = parseTypeScript(source, '/src/hoc/withLoading.tsx');
      const result = extractSymbols(tree, '/src/hoc/withLoading.tsx');

      // Interface
      const withLoadingProps = result.classes.find((c) => c.name === 'WithLoadingProps');
      expect(withLoadingProps).toBeDefined();

      // HOC function
      const hoc = result.topLevelFunctions[0]!;
      expect(hoc.name).toBe('withLoading');
      expect(hoc.typeParameters).toHaveLength(1);
      expect(hoc.typeParameters![0]!.name).toBe('P');
      expect(hoc.typeParameters![0]!.bounds).toContain('object');
    });
  });

  describe('Express patterns', () => {
    it('should extract router with route handlers', () => {
      const source = `
        import { Router, Request, Response } from 'express';

        const router = Router();

        router.get('/users', async (req: Request, res: Response) => {
          const users = await userRepository.findAll();
          res.json(users);
        });

        router.post('/users', async (req, res) => {
          const user = await userRepository.create(req.body);
          res.status(201).json(user);
        });

        export default router;
      `;
      const tree = parseTypeScript(source, '/src/routes/users.ts');
      const result = extractSymbols(tree, '/src/routes/users.ts');

      // Imports
      expect(result.imports).toHaveLength(3);
      expect(result.imports.map((i) => i.name)).toContain('Router');
      expect(result.imports.map((i) => i.name)).toContain('Request');
      expect(result.imports.map((i) => i.name)).toContain('Response');

      // Router variable
      expect(result.topLevelProperties).toHaveLength(1);
      expect(result.topLevelProperties[0]!.name).toBe('router');
    });

    it('should extract middleware function', () => {
      const source = `
        import { Request, Response, NextFunction } from 'express';

        export interface AuthRequest extends Request {
          user?: User;
        }

        export function authMiddleware(
          req: AuthRequest,
          res: Response,
          next: NextFunction
        ): void {
          const token = req.headers.authorization?.split(' ')[1];

          if (!token) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
          }

          try {
            const decoded = verifyToken(token);
            req.user = decoded;
            next();
          } catch (error) {
            res.status(401).json({ error: 'Invalid token' });
          }
        }
      `;
      const tree = parseTypeScript(source, '/src/middleware/auth.ts');
      const result = extractSymbols(tree, '/src/middleware/auth.ts');

      // AuthRequest interface extends Request
      const authRequest = result.classes.find((c) => c.name === 'AuthRequest');
      expect(authRequest).toBeDefined();
      expect(authRequest!.kind).toBe('interface');
      expect(authRequest!.interfaces).toContain('Request');

      // Middleware function
      const middleware = result.topLevelFunctions[0]!;
      expect(middleware.name).toBe('authMiddleware');
      expect(middleware.parameters).toHaveLength(3);
      expect(middleware.parameters[0]!.type).toBe('AuthRequest');
      expect(middleware.parameters[1]!.type).toBe('Response');
      expect(middleware.parameters[2]!.type).toBe('NextFunction');
      expect(middleware.returnType).toBe('void');
    });

    it('should extract error handler middleware', () => {
      const source = `
        import { Request, Response, NextFunction } from 'express';

        export class HttpException extends Error {
          statusCode: number;
          message: string;
        }

        export const errorHandler = (
          error: Error,
          req: Request,
          res: Response,
          next: NextFunction
        ): void => {
          if (error instanceof HttpException) {
            res.status(error.statusCode).json({ error: error.message });
            return;
          }

          console.error(error);
          res.status(500).json({ error: 'Internal Server Error' });
        };
      `;
      const tree = parseTypeScript(source, '/src/middleware/error-handler.ts');
      const result = extractSymbols(tree, '/src/middleware/error-handler.ts');

      // HttpException class extends Error
      const httpException = result.classes.find((c) => c.name === 'HttpException');
      expect(httpException).toBeDefined();
      expect(httpException!.superClass).toBe('Error');
      expect(httpException!.properties).toHaveLength(2);

      // Error handler arrow function
      const errorHandler = result.topLevelFunctions.find((f) => f.name === 'errorHandler');
      expect(errorHandler).toBeDefined();
      expect(errorHandler!.parameters).toHaveLength(4);
      expect(errorHandler!.returnType).toBe('void');
    });

    it('should extract controller class pattern', () => {
      const source = `
        import { Request, Response } from 'express';

        export class UserController {
          getAll = async (req: Request, res: Response): Promise<void> => {
            const users = await this.userService.findAll();
            res.json(users);
          };

          getById = async (req: Request, res: Response): Promise<void> => {
            const user = await this.userService.findById(req.params.id);
            if (!user) {
              res.status(404).json({ error: 'Not found' });
              return;
            }
            res.json(user);
          };

          create = async (req: Request, res: Response): Promise<void> => {
            const user = await this.userService.create(req.body);
            res.status(201).json(user);
          };
        }
      `;
      const tree = parseTypeScript(source, '/src/controllers/user.controller.ts');
      const result = extractSymbols(tree, '/src/controllers/user.controller.ts');

      const controller = result.classes[0]!;
      expect(controller.name).toBe('UserController');

      // Arrow function properties (class fields)
      expect(controller.properties).toHaveLength(3);
      expect(controller.properties.map((p) => p.name)).toContain('getAll');
      expect(controller.properties.map((p) => p.name)).toContain('getById');
      expect(controller.properties.map((p) => p.name)).toContain('create');
    });

    it('should extract app configuration with chained calls', () => {
      const source = `
        import express, { Application } from 'express';
        import cors from 'cors';
        import helmet from 'helmet';

        export function createApp(): Application {
          const app = express();

          app.use(helmet());
          app.use(cors());
          app.use(express.json());
          app.use(express.urlencoded({ extended: true }));

          return app;
        }
      `;
      const tree = parseTypeScript(source, '/src/app.ts');
      const result = extractSymbols(tree, '/src/app.ts');

      // Imports
      expect(result.imports.map((i) => i.name)).toContain('express');
      expect(result.imports.map((i) => i.name)).toContain('Application');
      expect(result.imports.map((i) => i.name)).toContain('cors');
      expect(result.imports.map((i) => i.name)).toContain('helmet');

      // createApp function
      const createApp = result.topLevelFunctions[0]!;
      expect(createApp.name).toBe('createApp');
      expect(createApp.returnType).toBe('Application');
    });
  });

  describe('Node.js vanilla patterns', () => {
    it('should extract file utilities with fs promises', () => {
      const source = `
        import * as fs from 'fs';
        import path from 'path';

        export async function readConfig(configPath: string): Promise<Config> {
          const fullPath = path.resolve(configPath);
          const content = await fs.promises.readFile(fullPath, 'utf-8');
          return JSON.parse(content);
        }

        export const DEFAULT_CONFIG: Config = {
          port: 3000,
          host: 'localhost',
        };
      `;
      const tree = parseTypeScript(source, '/src/utils/config.ts');
      const result = extractSymbols(tree, '/src/utils/config.ts');

      // Namespace import
      const fsImport = result.imports.find((i) => i.alias === 'fs');
      expect(fsImport).toBeDefined();
      expect(fsImport!.isWildcard).toBe(true);

      // Default import
      const pathImport = result.imports.find((i) => i.name === 'path');
      expect(pathImport).toBeDefined();

      // Async function
      const readConfig = result.topLevelFunctions[0]!;
      expect(readConfig.name).toBe('readConfig');
      expect(readConfig.isSuspend).toBe(true);
      expect(readConfig.returnType).toBe('Promise<Config>');

      // Object expression (DEFAULT_CONFIG)
      expect(result.objectExpressions).toHaveLength(1);
      expect(result.objectExpressions[0]!.properties).toHaveLength(2);
    });

    it('should extract event emitter pattern', () => {
      const source = `
        import { EventEmitter } from 'events';

        interface TaskEvents {
          start: (taskId: string) => void;
          progress: (taskId: string, percent: number) => void;
          complete: (taskId: string, result: unknown) => void;
          error: (taskId: string, error: Error) => void;
        }

        export class TaskRunner extends EventEmitter {
          private tasks: Map<string, Task> = new Map();

          async run(task: Task): Promise<void> {
            this.emit('start', task.id);

            try {
              const result = await task.execute((percent) => {
                this.emit('progress', task.id, percent);
              });
              this.emit('complete', task.id, result);
            } catch (error) {
              this.emit('error', task.id, error as Error);
            }
          }
        }
      `;
      const tree = parseTypeScript(source, '/src/task-runner.ts');
      const result = extractSymbols(tree, '/src/task-runner.ts');

      // Interface
      const taskEvents = result.classes.find((c) => c.name === 'TaskEvents');
      expect(taskEvents).toBeDefined();
      expect(taskEvents!.properties).toHaveLength(4);

      // Class extends EventEmitter
      const taskRunner = result.classes.find((c) => c.name === 'TaskRunner');
      expect(taskRunner).toBeDefined();
      expect(taskRunner!.superClass).toBe('EventEmitter');

      // Private property
      const tasksProperty = taskRunner!.properties.find((p) => p.name === 'tasks');
      expect(tasksProperty).toBeDefined();
      expect(tasksProperty!.visibility).toBe('private');

      // Async method
      const runMethod = taskRunner!.functions.find((f) => f.name === 'run');
      expect(runMethod).toBeDefined();
      expect(runMethod!.isSuspend).toBe(true);
    });

    it('should extract module with multiple exports', () => {
      const source = `
        export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

        export interface LoggerOptions {
          level: LogLevel;
          prefix?: string;
        }

        export function createLogger(options: LoggerOptions): Logger {
          return new ConsoleLogger(options);
        }

        export const defaultLogger = createLogger({ level: 'info' });

        export default createLogger;
      `;
      const tree = parseTypeScript(source, '/src/logger/index.ts');
      const result = extractSymbols(tree, '/src/logger/index.ts');

      // Type alias
      expect(result.typeAliases).toHaveLength(1);
      expect(result.typeAliases[0]!.name).toBe('LogLevel');

      // Interface
      const loggerOptions = result.classes.find((c) => c.name === 'LoggerOptions');
      expect(loggerOptions).toBeDefined();

      // Function
      const createLogger = result.topLevelFunctions.find((f) => f.name === 'createLogger');
      expect(createLogger).toBeDefined();

      // Variable
      expect(result.topLevelProperties.map((p) => p.name)).toContain('defaultLogger');
    });

    it('should extract class with static methods and properties', () => {
      const source = `
        export class Database {
          private static instance: Database | null = null;

          static getInstance(): Database {
            if (!Database.instance) {
              Database.instance = new Database(process.env.DATABASE_URL!);
            }
            return Database.instance;
          }

          static async connect(): Promise<void> {
            const instance = Database.getInstance();
            await instance.initialize();
          }

          private async initialize(): Promise<void> {
            // Initialize connection
          }

          async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
            // Execute query
            return [];
          }
        }
      `;
      const tree = parseTypeScript(source, '/src/database.ts');
      const result = extractSymbols(tree, '/src/database.ts');

      const database = result.classes[0]!;
      expect(database.name).toBe('Database');

      // Static property
      const instanceProp = database.properties.find((p) => p.name === 'instance');
      expect(instanceProp).toBeDefined();
      expect(instanceProp!.visibility).toBe('private');
      expect(instanceProp!.type).toBe('Database | null');

      // Static methods
      const getInstance = database.functions.find((f) => f.name === 'getInstance');
      expect(getInstance).toBeDefined();
      expect(getInstance!.returnType).toBe('Database');

      const connect = database.functions.find((f) => f.name === 'connect');
      expect(connect).toBeDefined();
      expect(connect!.isSuspend).toBe(true);
      expect(connect!.returnType).toBe('Promise<void>');

      // Instance methods
      const initialize = database.functions.find((f) => f.name === 'initialize');
      expect(initialize).toBeDefined();
      expect(initialize!.visibility).toBe('private');
      expect(initialize!.isSuspend).toBe(true);

      // Generic method
      const query = database.functions.find((f) => f.name === 'query');
      expect(query).toBeDefined();
      expect(query!.typeParameters).toHaveLength(1);
      expect(query!.typeParameters![0]!.name).toBe('T');
      expect(query!.isSuspend).toBe(true);
    });

    it('should extract utility functions with generics and overloads', () => {
      const source = `
        export function debounce<T extends (...args: unknown[]) => unknown>(
          fn: T,
          delay: number
        ): (...args: Parameters<T>) => void {
          let timeoutId: NodeJS.Timeout | null = null;

          return (...args: Parameters<T>) => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => fn(...args), delay);
          };
        }

        export function throttle<T extends (...args: unknown[]) => unknown>(
          fn: T,
          limit: number
        ): (...args: Parameters<T>) => void {
          let inThrottle = false;

          return (...args: Parameters<T>) => {
            if (!inThrottle) {
              fn(...args);
              inThrottle = true;
              setTimeout(() => (inThrottle = false), limit);
            }
          };
        }

        export function memoize<T extends (...args: unknown[]) => unknown>(
          fn: T,
          keyResolver?: (...args: Parameters<T>) => string
        ): T {
          const cache = new Map<string, ReturnType<T>>();

          return ((...args: Parameters<T>) => {
            const key = keyResolver ? keyResolver(...args) : JSON.stringify(args);
            if (cache.has(key)) {
              return cache.get(key)!;
            }
            const result = fn(...args);
            cache.set(key, result);
            return result;
          }) as T;
        }
      `;
      const tree = parseTypeScript(source, '/src/utils/function-utils.ts');
      const result = extractSymbols(tree, '/src/utils/function-utils.ts');

      expect(result.topLevelFunctions).toHaveLength(3);

      // debounce
      const debounce = result.topLevelFunctions.find((f) => f.name === 'debounce');
      expect(debounce).toBeDefined();
      expect(debounce!.typeParameters).toHaveLength(1);
      expect(debounce!.parameters).toHaveLength(2);

      // throttle
      const throttle = result.topLevelFunctions.find((f) => f.name === 'throttle');
      expect(throttle).toBeDefined();
      expect(throttle!.typeParameters).toHaveLength(1);

      // memoize
      const memoize = result.topLevelFunctions.find((f) => f.name === 'memoize');
      expect(memoize).toBeDefined();
      expect(memoize!.typeParameters).toHaveLength(1);
      expect(memoize!.returnType).toBe('T');
    });
  });

  describe('Function overloads', () => {
    it('should extract function overloads with linked signatures', () => {
      const source = `
        function parse(input: string): Document;
        function parse(input: Buffer): Document;
        function parse(input: string | Buffer): Document {
          return new Document();
        }
      `;
      const tree = parseTypeScript(source, '/src/parser.ts');
      const result = extractSymbols(tree, '/src/parser.ts');

      // Should have a single function with overloads
      expect(result.topLevelFunctions).toHaveLength(1);

      const parse = result.topLevelFunctions[0]!;
      expect(parse.name).toBe('parse');
      expect(parse.isOverloadSignature).toBeUndefined();

      // Implementation signature
      expect(parse.parameters[0]?.type).toBe('string | Buffer');
      expect(parse.returnType).toBe('Document');

      // Overload signatures
      expect(parse.overloads).toHaveLength(2);
      expect(parse.overloads![0]?.parameters[0]?.type).toBe('string');
      expect(parse.overloads![1]?.parameters[0]?.type).toBe('Buffer');
    });

    it('should extract generic function overloads', () => {
      const source = `
        function convert<T>(value: T): T;
        function convert<T, U>(value: T, transformer: (t: T) => U): U;
        function convert<T, U>(value: T, transformer?: (t: T) => U): T | U {
          return transformer ? transformer(value) : value;
        }
      `;
      const tree = parseTypeScript(source, '/src/convert.ts');
      const result = extractSymbols(tree, '/src/convert.ts');

      expect(result.topLevelFunctions).toHaveLength(1);

      const convert = result.topLevelFunctions[0]!;
      expect(convert.name).toBe('convert');
      expect(convert.overloads).toHaveLength(2);

      // First overload: <T>(value: T): T
      const overload1 = convert.overloads![0]!;
      expect(overload1.typeParameters).toHaveLength(1);
      expect(overload1.typeParameters![0]?.name).toBe('T');
      expect(overload1.parameters).toHaveLength(1);
      expect(overload1.returnType).toBe('T');

      // Second overload: <T, U>(value: T, transformer: (t: T) => U): U
      const overload2 = convert.overloads![1]!;
      expect(overload2.typeParameters).toHaveLength(2);
      expect(overload2.parameters).toHaveLength(2);
      expect(overload2.returnType).toBe('U');
    });

    it('should extract method overloads in class', () => {
      const source = `
        class Parser {
          parse(input: string): Document;
          parse(input: Buffer): Document;
          parse(input: string | Buffer): Document {
            return new Document();
          }

          format(data: string): string;
          format(data: number): string;
          format(data: string | number): string {
            return String(data);
          }
        }
      `;
      const tree = parseTypeScript(source, '/src/parser.ts');
      const result = extractSymbols(tree, '/src/parser.ts');

      const parser = result.classes[0]!;
      expect(parser.name).toBe('Parser');

      // Should have 2 methods (parse and format), each with overloads linked
      expect(parser.functions).toHaveLength(2);

      const parse = parser.functions.find((f) => f.name === 'parse');
      expect(parse).toBeDefined();
      expect(parse!.overloads).toHaveLength(2);
      expect(parse!.overloads![0]?.parameters[0]?.type).toBe('string');
      expect(parse!.overloads![1]?.parameters[0]?.type).toBe('Buffer');

      const format = parser.functions.find((f) => f.name === 'format');
      expect(format).toBeDefined();
      expect(format!.overloads).toHaveLength(2);
      expect(format!.overloads![0]?.parameters[0]?.type).toBe('string');
      expect(format!.overloads![1]?.parameters[0]?.type).toBe('number');
    });

    it('should extract constructor overloads', () => {
      const source = `
        class Parser {
          constructor(options: string);
          constructor(options: ParserOptions);
          constructor(options: string | ParserOptions) {
            console.log(options);
          }
        }
      `;
      const tree = parseTypeScript(source, '/src/parser.ts');
      const result = extractSymbols(tree, '/src/parser.ts');

      const parser = result.classes[0]!;
      expect(parser.name).toBe('Parser');

      // Constructor overloads are extracted as methods named "constructor"
      const constructorMethod = parser.functions.find((f) => f.name === 'constructor');
      expect(constructorMethod).toBeDefined();
      expect(constructorMethod!.overloads).toHaveLength(2);
      expect(constructorMethod!.overloads![0]?.parameters[0]?.type).toBe('string');
      expect(constructorMethod!.overloads![1]?.parameters[0]?.type).toBe('ParserOptions');
    });

    it('should extract exported function overloads', () => {
      const source = `
        export function createElement(type: string): HTMLElement;
        export function createElement(type: 'div'): HTMLDivElement;
        export function createElement(type: 'span'): HTMLSpanElement;
        export function createElement(type: string): HTMLElement {
          return document.createElement(type);
        }
      `;
      const tree = parseTypeScript(source, '/src/dom.ts');
      const result = extractSymbols(tree, '/src/dom.ts');

      expect(result.topLevelFunctions).toHaveLength(1);

      const createElement = result.topLevelFunctions[0]!;
      expect(createElement.name).toBe('createElement');
      expect(createElement.overloads).toHaveLength(3);
    });

    it('should handle function with no overloads', () => {
      const source = `
        function regularFunction(value: string): number {
          return parseInt(value, 10);
        }
      `;
      const tree = parseTypeScript(source, '/src/utils.ts');
      const result = extractSymbols(tree, '/src/utils.ts');

      expect(result.topLevelFunctions).toHaveLength(1);
      const func = result.topLevelFunctions[0]!;
      expect(func.name).toBe('regularFunction');
      expect(func.overloads).toBeUndefined();
    });

    it('should handle ambient function declarations (signatures only)', () => {
      const source = `
        declare function externalFn(x: string): string;
        declare function externalFn(x: number): number;
      `;
      const tree = parseTypeScript(source, '/src/ambient.d.ts');
      const result = extractSymbols(tree, '/src/ambient.d.ts');

      // Ambient declarations with no implementation keep all signatures
      expect(result.topLevelFunctions).toHaveLength(2);
      expect(result.topLevelFunctions.every((f) => f.isOverloadSignature)).toBe(true);
    });
  });
});
