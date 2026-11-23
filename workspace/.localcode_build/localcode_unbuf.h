#include <stdio.h>
__attribute__((constructor, used)) static void _lc_unbuf(void){ setvbuf(stdout, NULL, _IONBF, 0); }
