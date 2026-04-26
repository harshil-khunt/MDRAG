# MULTI-DOCUMENT RETRIEVAL AUGMENTED GENERATION (MDRAG) SYSTEM

## PROJECT REPORT

---

**Submitted by:**  
[Student Name]  
[Roll Number]  
[Department/Program]

**Under the guidance of:**  
[Guide Name]  
[Designation]

**Academic Year:** 2025-2026

---

## TABLE OF CONTENTS

| Chapter | Title | Page |
|---------|-------|------|
| | **ABSTRACT** | i |
| | **LIST OF FIGURES** | ii |
| | **LIST OF TABLES** | iii |
| | **ABBREVIATIONS** | iv |
| **1** | **INTRODUCTION** | 1 |
| | 1.1 Background | 2 |
| | 1.2 Problem Statement | 2 |
| | 1.3 Motivation and Objectives | 3 |
| | 1.4 Scope | 3 |
| | 1.5 Technology and Tools | 4 |
| | 1.5.1 Front-End Technology | 4 |
| | 1.5.2 Back-End Technology | 5 |
| | 1.5.3 Database | 5 |
| | 1.6 Synopsis | 6 |
| **2** | **LITERATURE SURVEY** | 7 |
| | 2.1 Introduction of Survey | 8 |
| | 2.2 Why Survey? | 9 |
| **3** | **PROJECT MANAGEMENT** | 10 |
| | 3.1 Project Overview and Life Cycle | 11 |
| | 3.2 Roles and Responsibilities | 11 |
| | 3.3 Work Breakdown | 12 |
| | 3.4 Tools Used | 12 |
| | 3.5 Milestones and Deliverables | 13 |
| | 3.6 Risk Management | 13 |
| | 3.7 Time Planning | 14 |
| | 3.8 Communication Plan | 14 |
| **4** | **SYSTEM REQUIREMENTS** | 15 |
| | 4.1 Functional Requirements | 16 |
| | 4.2 Non-Functional Requirements | 17 |
| | 4.3 Constraints | 18 |
| | 4.4 Assumptions and Dependencies | 18 |
| **5** | **SYSTEM ANALYSIS** | 19 |
| | 5.1 Study of Current System | 20 |
| | 5.2 Problems in Current System | 20 |
| | 5.3 Requirement of New System | 21 |
| | 5.4 Process Model | 22 |
| | 5.5 Feasibility Study | 23 |
| | 5.5.1 Technical Feasibility | 23 |
| | 5.5.2 Operational Feasibility | 23 |
| | 5.5.3 Economical Feasibility | 24 |
| | 5.5.4 Schedule Feasibility | 24 |
| **6** | **DETAIL DESCRIPTION** | 25 |
| | 6.1 Workspace Management Module | 26 |
| | 6.2 Document Upload Module | 27 |
| | 6.3 URL Crawling Module | 29 |
| | 6.4 Q&A Management Module | 30 |
| | 6.5 Custom Text Module | 31 |
| | 6.6 Chat Interface Module | 32 |
| | 6.7 Admin Module | 33 |
| **7** | **TESTING** | 35 |
| | 7.1 Testing Strategy | 36 |
| | 7.2 Test Environment | 36 |
| | 7.3 Test Cases | 37 |
| | 7.4 Automated Unit Coverage | 40 |
| | 7.5 Traceability | 41 |
| | 7.6 Security-Oriented Tests | 42 |
| **8** | **SYSTEM DESIGN** | 43 |
| | 8.1 Design Rationale | 44 |
| | 8.2 Context Diagram (Level 0 DFD) | 44 |
| | 8.3 Level 1 DFD | 45 |
| | 8.4 Activity Diagrams | 46 |
| | 8.5 Use Case Diagram | 47 |
| | 8.6 Deployment Architecture | 47 |
| | 8.7 Layered Logical Architecture | 48 |
| | 8.8 ER Diagram | 48 |
| | 8.9 Class Diagram (Logical Layers) | 50 |
| **9** | **LIMITATION AND FUTURE ENHANCEMENTS** | 51 |
| | 9.1 Limitations | 52 |
| | 9.2 Future Enhancements | 53 |
| **10** | **CONCLUSION** | 54 |
| | 10.1 Conclusion | 55 |
| | **BIBLIOGRAPHY** | 56 |

---

## ABSTRACT

The Multi-Document Retrieval Augmented Generation (MDRAG) system represents an innovative approach to intelligent document management and question-answering. In today's information-driven world, organizations and individuals face the challenge of efficiently extracting meaningful insights from vast collections of documents, web content, and unstructured data. Traditional search systems often fall short in providing contextually relevant answers, requiring users to manually sift through multiple documents to find specific information.

MDRAG addresses this challenge by combining advanced artificial intelligence technologies with modern web development practices. The system leverages Retrieval-Augmented Generation, a cutting-edge AI technique that enhances large language models with domain-specific knowledge retrieved from user-uploaded documents. This approach ensures that responses are not only accurate but also grounded in the actual content provided by users, eliminating the risk of AI hallucinations and maintaining information integrity.

The system architecture comprises a React-based frontend built with TypeScript and modern UI frameworks, providing an intuitive user experience. The backend utilizes Node.js with Express.js for robust API handling, BullMQ with Redis for efficient background job processing, and MongoDB for metadata storage. Vector embeddings are stored in Pinecone, enabling fast semantic search across millions of document chunks. The system supports multiple AI providers including Google Gemini and OpenAI, giving users flexibility in choosing their preferred language model.

Key features include multi-format document upload supporting PDF, DOC, DOCX, and TXT files with OCR capabilities for image-based text extraction. The URL crawling module can automatically discover and process entire websites using sitemap analysis or recursive crawling with configurable depth and path filtering. Change tracking monitors web sources for updates and automatically re-processes modified content. Users can create custom question-answer pairs for frequently asked questions and add custom text entries for business-specific information.

The chat interface provides natural language interaction with uploaded content, maintaining conversation history for context-aware responses. Each answer includes source citations with document names and relevance scores, ensuring transparency and traceability. The workspace isolation feature allows users to organize different projects or clients separately, with each workspace maintaining its own document collection and AI configuration.

This project demonstrates the practical application of modern AI technologies in solving real-world information retrieval challenges. The system has been designed with scalability, security, and user experience as primary considerations, making it suitable for deployment in educational institutions, corporate environments, and research organizations.

---

## LIST OF FIGURES

| Figure No. | Figure Title | Page |
|------------|--------------|------|
| 1.1 | System Architecture Overview | 6 |
| 5.1 | Agile Development Process Model | 22 |
| 6.1 | Workspace Management Workflow | 26 |
| 6.2 | Document Processing Pipeline | 28 |
| 6.3 | URL Crawling Architecture | 29 |
| 6.4 | RAG Query Processing Flow | 32 |
| 8.1 | Context Diagram (Level 0 DFD) | 44 |
| 8.2 | Level 1 Data Flow Diagram | 45 |
| 8.3 | Use Case Diagram | 47 |
| 8.4 | Deployment Architecture | 48 |
| 8.5 | Entity-Relationship Diagram | 49 |

---

## LIST OF TABLES

| Table No. | Table Title | Page |
|-----------|-------------|------|
| 3.1 | Project Roles and Responsibilities | 11 |
| 3.2 | Development Tools and Technologies | 12 |
| 3.3 | Project Milestones and Timeline | 13 |
| 4.1 | Functional Requirements Specification | 16 |
| 4.2 | Non-Functional Requirements | 17 |
| 5.1 | Feasibility Analysis Summary | 24 |
| 7.1 | Test Environment Configuration | 36 |
| 7.2 | Test Case Summary | 37 |
| 7.3 | Security Test Results | 42 |
| 9.1 | System Limitations and Mitigation | 52 |

---

## ABBREVIATIONS

| Abbreviation | Full Form |
|--------------|-----------|
| **AI** | Artificial Intelligence |
| **API** | Application Programming Interface |
| **CORS** | Cross-Origin Resource Sharing |
| **CSS** | Cascading Style Sheets |
| **DB** | Database |
| **DFD** | Data Flow Diagram |
| **DOC** | Microsoft Word Document |
| **DOCX** | Microsoft Word Open XML Document |
| **ER** | Entity-Relationship |
| **HTML** | HyperText Markup Language |
| **HTTP** | HyperText Transfer Protocol |
| **HTTPS** | HyperText Transfer Protocol Secure |
| **IDE** | Integrated Development Environment |
| **JSON** | JavaScript Object Notation |
| **JWT** | JSON Web Token |
| **LLM** | Large Language Model |
| **MDRAG** | Multi-Document Retrieval Augmented Generation |
| **ML** | Machine Learning |
| **NLP** | Natural Language Processing |
| **NoSQL** | Not Only Structured Query Language |
| **NPM** | Node Package Manager |
| **OCR** | Optical Character Recognition |
| **PDF** | Portable Document Format |
| **Q&A** | Question and Answer |
| **RAG** | Retrieval-Augmented Generation |
| **REST** | Representational State Transfer |
| **SDK** | Software Development Kit |
| **SQL** | Structured Query Language |
| **SSL** | Secure Sockets Layer |
| **TLS** | Transport Layer Security |
| **TXT** | Text File |
| **UI** | User Interface |
| **URL** | Uniform Resource Locator |
| **UX** | User Experience |
| **XML** | Extensible Markup Language |

---

Table 4.1: Functional Requirements Specification

ID	Requirement	Description	Priority
FR-1	Workspace Management	Users shall be able to create, view, and manage multiple isolated workspaces	High
FR-1.1	Create Workspace	System shall allow users to create new workspaces with unique names and AI provider selection (Gemini or OpenAI)	High
FR-1.2	List Workspaces	System shall display all created workspaces with metadata including creation date and document count	High
FR-1.3	Configure AI Provider	Users shall select AI provider (Gemini or OpenAI) during workspace creation, which cannot be changed later	High
FR-1.4	API Key Management	Users shall optionally provide their own API keys for AI services or use default system keys	Medium
FR-1.5	Chatbot Role Configuration	Users shall configure chatbot roles (customer service, sales, technical support, custom) with custom prompts	Medium
FR-2	Document Upload and Processing	Users shall be able to upload documents in multiple formats for processing	High
FR-2.1	File Upload	System shall accept file uploads via drag-and-drop or file selector for PDF, DOC, DOCX, and TXT formats	High
FR-2.2	Text Extraction	System shall automatically extract text content from uploaded documents	High
FR-2.3	OCR Processing	System shall perform OCR on scanned PDFs and images to extract text	Medium
FR-2.4	Document Chunking	System shall split documents into semantic chunks with configurable size and overlap	High
FR-2.5	Embedding Generation	System shall generate vector embeddings for each chunk using the workspace's configured AI provider	High
FR-2.6	Background Processing	System shall process documents asynchronously in background jobs without blocking user interface	High
FR-2.7	Processing Status	Users shall view real-time processing status and progress for uploaded documents	Medium
FR-3	URL Crawling	Users shall be able to submit URLs for content extraction and processing	High
FR-3.1	Single URL Processing	System shall extract and process content from individual web pages	High
FR-3.2	Sitemap Crawling	System shall discover and crawl all pages listed in website sitemaps	High
FR-3.3	Recursive Crawling	System shall recursively follow links with configurable depth limits (max 3 levels)	Medium
FR-3.4	Path Filtering	Users shall specify include/exclude path patterns for selective crawling	Medium
FR-3.5	Change Tracking	System shall monitor tracked URLs for content changes and automatically re-process modified pages	Medium
FR-3.6	Scheduled Re-crawling	System shall periodically check tracked sources for updates based on configured schedules	Low
FR-4	Q&A Management	Users shall be able to create and manage custom question-answer pairs	Medium
FR-4.1	Create Q&A Pairs	Users shall create Q&A pairs with questions and answers up to 10,000 characters each	Medium
FR-4.2	Edit Q&A Pairs	Users shall edit existing Q&A pairs to update questions or answers	Medium
FR-4.3	Delete Q&A Pairs	Users shall delete Q&A pairs that are no longer needed	Medium
FR-4.4	Q&A Embedding	System shall generate embeddings for questions to enable semantic matching	Medium
FR-4.5	Q&A Priority	System shall prioritize Q&A matches over document chunks when similarity exceeds threshold	Medium
FR-5	Custom Text Management	Users shall be able to add custom text content directly without file uploads	Medium
FR-5.1	Add Custom Text	Users shall add custom text entries with titles and content up to 10,000 characters	Medium
FR-5.2	Edit Custom Text	Users shall edit existing custom text entries	Medium
FR-5.3	Delete Custom Text	Users shall delete custom text entries	Medium
FR-5.4	Custom Text Processing	System shall process custom text entries identically to uploaded documents	Medium
FR-6	Intelligent Question Answering	Users shall be able to ask questions and receive accurate answers based on uploaded content	High
FR-6.1	Natural Language Queries	System shall accept questions in natural language without requiring specific syntax	High
FR-6.2	Semantic Search	System shall retrieve relevant content using vector similarity search	High
FR-6.3	Answer Generation	System shall generate natural language answers using retrieved content and LLMs	High
FR-6.4	Source Citations	System shall provide source citations including document names and relevance scores for each answer	High
FR-6.5	Conversation History	System shall maintain conversation history and use context from previous messages	Medium
FR-6.6	Confidence Scoring	System shall provide confidence scores (High/Medium/Low) indicating answer reliability	Medium
FR-6.7	Fallback Responses	System shall provide appropriate responses when no relevant content is found	High
FR-7	Document Management	Users shall be able to view and manage processed documents	Medium
FR-7.1	List Documents	System shall display all documents in a workspace with metadata including type, size, and processing date	Medium
FR-7.2	Delete Documents	Users shall delete documents and all associated chunks and embeddings	Medium
FR-7.3	Document Statistics	System shall show document count, total chunks, and storage usage per workspace	Low
FR-8	Usage Analytics	Users shall be able to view system usage statistics	LowTable 7.1: Test Environment Configuration

Component	Test Configuration	Production Configuration	Notes
Backend Server	Node.js 18.x on localhost:3100	Node.js 18.x on production server	Same version ensures consistency
Frontend	Vite dev server on localhost:5173	Static build served by Nginx	Dev server for hot reload during testing
MongoDB	Local MongoDB 5.9 or test database	MongoDB Atlas cluster	Separate test database prevents data corruption
Redis	Local Redis 6.0 on localhost:6379	Redis Labs cloud instance	Local instance for faster testing
Pinecone	Test namespace in shared index	Production namespace	Namespace isolation prevents test data pollution
AI APIs	Test API keys with rate limits	Production API keys	Separate keys track test usage
File Storage	Local tmp/ and uploads/ directories	Cloud storage or local directories	Cleaned after each test run
Worker Process	Single worker instance	Multiple worker instances	Sufficient for test load
FR-8.1	Vector Count	System shall display total vector count per workspace	Low
FR-8.2	Storage Usage	System shall show storage usage for documents and embeddings	Low
FR-8.3	Query Statistics	System shall track and display query counts and response times	Low