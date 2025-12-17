*** Settings ***
Library           BuiltIn

*** Test Cases ***
Smoke Should Pass
    [Documentation]    Minimal smoke test for integration
    Should Be Equal    1    1

Smoke Should Fail
    [Documentation]    Example failing test (comment out to keep smoke green)
    # Uncomment to simulate failure
    # Should Be Equal    1    2
