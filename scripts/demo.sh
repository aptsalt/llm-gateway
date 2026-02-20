#!/bin/bash
# LLM Gateway — Interactive Demo Script
# Showcases all major features with colored output

set -e

GATEWAY="http://localhost:4000"
BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
RESET="\033[0m"
DIM="\033[2m"

pause() {
  echo ""
  echo -e "${DIM}Press Enter to continue...${RESET}"
  read -r
}

header() {
  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}${CYAN}  $1${RESET}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
}

run() {
  echo -e "${YELLOW}\$ $1${RESET}"
  echo ""
  eval "$1" 2>&1 | head -40
  echo ""
}

clear
echo -e "${BOLD}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║         LLM Gateway — Feature Demo            ║"
echo "  ║                                               ║"
echo "  ║   Multi-provider AI gateway with smart        ║"
echo "  ║   routing, caching, and cost control          ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo -e "${RESET}"
pause

# 1. Gateway Status
header "1. Gateway Health & Status"
run "curl -s $GATEWAY/ | python3 -m json.tool 2>/dev/null || curl -s $GATEWAY/ | jq . 2>/dev/null || curl -s $GATEWAY/"
pause

# 2. Health Check
header "2. Provider Health Check"
run "curl -s $GATEWAY/health | python3 -m json.tool 2>/dev/null || curl -s $GATEWAY/health | jq . 2>/dev/null || curl -s $GATEWAY/health"
pause

# 3. Available Models
header "3. Available Models"
run "curl -s $GATEWAY/v1/models | python3 -m json.tool 2>/dev/null || curl -s $GATEWAY/v1/models | jq '.data[:5]' 2>/dev/null || curl -s $GATEWAY/v1/models"
pause

# 4. Smart Routing (auto)
header "4. Smart Routing — Auto Mode"
echo -e "${GREEN}The router analyzes prompt complexity and picks the best model.${RESET}"
echo ""
run "curl -s $GATEWAY/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\": \"auto\", \"messages\": [{\"role\": \"user\", \"content\": \"What is 2+2?\"}]}' | python3 -m json.tool 2>/dev/null || curl -s $GATEWAY/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\": \"auto\", \"messages\": [{\"role\": \"user\", \"content\": \"What is 2+2?\"}]}'"
pause

# 5. Cost-Optimized Routing
header "5. Cost-Optimized Routing"
echo -e "${GREEN}Route to the cheapest model that can handle the task.${RESET}"
echo ""
run "curl -s $GATEWAY/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\": \"cheap\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]}' | python3 -m json.tool 2>/dev/null || curl -s $GATEWAY/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\": \"cheap\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]}'"
pause

# 6. Quality Routing (complex task)
header "6. Quality Routing — Complex Code Task"
echo -e "${GREEN}Complex prompts are routed to high-quality models.${RESET}"
echo ""
run "curl -s $GATEWAY/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\": \"quality\", \"messages\": [{\"role\": \"user\", \"content\": \"Write a Python function that implements merge sort with type hints\"}], \"x-routing-strategy\": \"quality\"}' | python3 -m json.tool 2>/dev/null || curl -s $GATEWAY/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\": \"quality\", \"messages\": [{\"role\": \"user\", \"content\": \"Write a Python function that implements merge sort with type hints\"}], \"x-routing-strategy\": \"quality\"}'"
pause

# 7. Streaming
header "7. Streaming Response (SSE)"
echo -e "${GREEN}Real-time token streaming via Server-Sent Events.${RESET}"
echo ""
run "curl -sN $GATEWAY/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\": \"auto\", \"messages\": [{\"role\": \"user\", \"content\": \"Write a haiku about APIs\"}], \"stream\": true}' | head -10"
pause

# 8. Cache Hit
header "8. Semantic Cache Demo"
echo -e "${GREEN}Second identical request hits the cache (0ms, \$0 cost).${RESET}"
echo ""
echo -e "${DIM}First request (cache miss):${RESET}"
run "curl -s $GATEWAY/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\": \"auto\", \"messages\": [{\"role\": \"user\", \"content\": \"Explain quantum computing in one sentence\"}]}' | python3 -m json.tool 2>/dev/null || echo '(response received)'"
echo -e "${DIM}Second request (cache hit):${RESET}"
run "curl -s $GATEWAY/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\": \"auto\", \"messages\": [{\"role\": \"user\", \"content\": \"Explain quantum computing in one sentence\"}]}' | python3 -m json.tool 2>/dev/null || echo '(response received from cache)'"
pause

# 9. Provider Status
header "9. Provider Status & Circuit Breakers"
run "curl -s $GATEWAY/api/providers | python3 -m json.tool 2>/dev/null || curl -s $GATEWAY/api/providers"
echo ""
run "curl -s $GATEWAY/api/circuit-breakers | python3 -m json.tool 2>/dev/null || curl -s $GATEWAY/api/circuit-breakers"
pause

# 10. Analytics
header "10. Real-Time Analytics"
run "curl -s $GATEWAY/api/analytics | python3 -m json.tool 2>/dev/null || curl -s $GATEWAY/api/analytics"
pause

# 11. Cache Stats
header "11. Cache Statistics"
run "curl -s $GATEWAY/api/cache/stats | python3 -m json.tool 2>/dev/null || curl -s $GATEWAY/api/cache/stats"
pause

# 12. Benchmarks
header "12. Benchmark Suite"
echo -e "${GREEN}14 tasks across 5 categories with 4 scoring strategies.${RESET}"
echo ""
run "curl -s $GATEWAY/api/benchmarks | python3 -m json.tool 2>/dev/null || curl -s $GATEWAY/api/benchmarks"
pause

# Done
header "Demo Complete!"
echo -e "${GREEN}  LLM Gateway is production-ready with:${RESET}"
echo ""
echo "  - OpenAI-compatible API (drop-in replacement)"
echo "  - Smart routing across 5 providers"
echo "  - Semantic caching (cosine similarity)"
echo "  - Per-key budgets & rate limiting"
echo "  - Circuit breakers & automatic failover"
echo "  - Prometheus metrics & structured logging"
echo "  - Automated benchmarking suite"
echo ""
echo -e "${CYAN}  GitHub: https://github.com/aptsalt/llm-gateway${RESET}"
echo ""
