import React from "react";

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "h-8 w-auto" }: LogoProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="251 288 522 192" 
      className={className}
      xmlSpace="preserve"
    >
      <g transform="matrix(3.2622 0 0 3.2622 512 384)" id="glyphGroup_textPair_1783624353486_0.8829139937506101">
        <g>
          {/* Z path: switches between dark charcoal in light mode and pure white in dark mode */}
          <g transform="matrix(1 0 0 1 -59.0759 0.8288)">
            <g>
              <g transform="matrix(1 0 0 1 0 0)">
                <path 
                  className="fill-[#241f1f] dark:fill-white transition-colors duration-200" 
                  transform="translate(-100, -100)" 
                  d="M 79.2622 119.8227 L 104.313 82.6465 L 79.9106 82.6465 L 87.8315 71.9175 L 119.73 71.9175 L 119.73 80.1836 L 94.4409 117.353 L 120.7378 117.353 L 112.8169 128.0825 L 79.2622 128.0825 L 79.2622 119.8227 Z"
                />
              </g>
            </g>
          </g>
          
          {/* l path: brand primary accent color #e73700 */}
          <g transform="matrix(1 0 0 1 -28.4413 -0.1072)">
            <g>
              <g transform="matrix(1 0 0 1 0 0)">
                <path 
                  className="fill-[#e73700]" 
                  transform="translate(-100.0011, -95.8215)" 
                  d="M 105.4375 66.803 L 105.4375 124.84 L 94.5647 124.84 L 94.5647 70.4033 L 105.4375 66.803 Z"
                />
              </g>
            </g>
          </g>
          
          {/* i path: brand primary accent color #e73700 */}
          <g transform="matrix(1 0 0 1 -10.8012 8.1361)">
            <g>
              <g transform="matrix(1 0 0 1 0 0)">
                <path 
                  className="fill-[#e73700]" 
                  transform="translate(-100.001, -104.0662)" 
                  d="M 105.4375 83.2924 L 105.4375 124.84 L 94.5645 124.84 L 94.5645 86.8928 L 105.4375 83.2924 Z"
                />
              </g>
            </g>
          </g>
          
          {/* n path: brand primary accent color #e73700 */}
          <g transform="matrix(1 0 0 1 19.1158 8.64)">
            <g>
              <g transform="matrix(1 0 0 1 0 0)">
                <path 
                  className="fill-[#e73700]" 
                  transform="translate(-100.3623, -104.5703)" 
                  d="M 118.5078 103.5262 L 118.5078 124.8401 L 107.707 124.8401 L 107.707 103.5262 C 107.707 99.4939 104.3948 96.1815 100.3623 96.1815 C 96.69 96.1815 93.5938 98.9178 93.0899 102.5181 L 93.0899 124.8401 L 82.2888 124.8401 L 82.2888 103.5262 L 82.2168 103.5262 C 82.2168 103.0222 82.2168 102.4461 82.2888 101.942 L 82.2888 84.3005 L 93.0899 84.3005 L 93.0899 86.8928 C 95.322 85.8847 97.8423 85.3806 100.3623 85.3806 C 105.1868 85.3806 109.7952 87.2528 113.1795 90.7091 C 116.6358 94.1654 118.5078 98.7017 118.5078 103.5262 Z"
                />
              </g>
            </g>
          </g>
          
          {/* e path: brand primary accent color #e73700 */}
          <g transform="matrix(1 0 0 1 59.508 8.856)">
            <g>
              <g transform="matrix(1 0 0 1 0 0)">
                <path 
                  className="fill-[#e73700]" 
                  transform="translate(-100.1462, -104.7863)" 
                  d="M 85.8169 119.1516 C 82.0006 115.3352 79.8405 110.2227 79.8405 104.8223 C 79.8405 99.3498 82.0006 94.3094 85.8169 90.421 C 89.6333 86.6047 94.7457 84.5166 100.1463 84.5166 C 105.5466 84.5166 110.6591 86.6047 114.4754 90.421 C 118.3638 94.3094 120.4519 99.3498 120.4519 104.8223 L 120.4519 110.0067 L 91.7935 110.0067 C 93.5936 112.815 96.6179 114.6151 100.1462 114.6151 C 102.8825 114.6151 105.4746 113.5351 107.3468 111.5189 L 114.9075 118.7195 C 113.0353 120.7357 110.8031 122.2478 108.3549 123.3999 C 105.7627 124.48 103.0264 125.0561 100.1462 125.0561 C 94.7457 125.056 89.6333 122.9679 85.8169 119.1516 Z M 108.4989 99.5659 C 106.7708 96.8296 103.6746 94.9575 100.1463 94.9575 C 96.6179 94.9575 93.5936 96.8296 91.7935 99.5659 L 108.4989 99.5659 Z"
                />
              </g>
            </g>
          </g>
          
        </g>
      </g>
    </svg>
  );
}
