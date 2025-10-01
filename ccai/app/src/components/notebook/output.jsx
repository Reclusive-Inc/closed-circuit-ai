import {useEffect, useRef, useState} from 'react';
import {CodeHighlight} from '../code-highlight';
import {Ansi} from '../ansi';

export const HtmlOutput = ({content, className}) => {
    const elementRef = useRef(null);

    useEffect(() => {
        if (elementRef.current && content) {
            const div = document.createElement('div');
            div.innerHTML = content;
            elementRef.current.appendChild(div);
            return () => {
                if (elementRef.current && div) {
                    elementRef.current.removeChild(div);
                }
            };
        }
    }, [content]);

    return <div ref={elementRef} className={className}></div>;
};

export const JavascriptOutput = ({content, className}) => {
    const elementRef = useRef(null);
    const [shouldRun, setShouldRun] = useState(false);

    useEffect(() => {
        if (elementRef.current && content && shouldRun) {
            const scriptElement = document.createElement('script');
            scriptElement.textContent = content;
            elementRef.current.appendChild(scriptElement);
            return () => {
                if (elementRef.current && scriptElement) {
                    elementRef.current.removeChild(scriptElement);
                }
            };
        }
    }, [content, shouldRun]);

    return (
        <>
            <div className={`${shouldRun ? 'opacity-50' : 'opacity-100'}`}>
                <pre><CodeHighlight content={'// Javascript'} className="language-javascript"/></pre>
                <pre><CodeHighlight content={content} className="language-javascript"/></pre>
                {!shouldRun && (
                    <div className="py-1">
                        <button className="px-2" onClick={() => setShouldRun(true)}>Run</button>
                    </div>
                )}

            </div>
            <div ref={elementRef} className={className}></div>
        </>
    );
};

export const CellOutput = ({output}) => {
    return (
        <div className="overflow-hidden px-2">
            {
                (() => {
                    if (output.output_type === 'display_data' || output.output_type === 'execute_result') {
                        const data = output.data || {};

                        // html
                        if (data['text/html']) {
                            return (<HtmlOutput content={data['text/html']}/>);
                        }

                        // javascript
                        if (data['text/javascript'] || data['application/javascript']) {
                            return (<JavascriptOutput content={data['text/javascript'] || data['application/javascript']}/>);
                        }

                        // image
                        if (data['image/png']) {
                            return (<img src={`data:image/png;base64,${data['image/png']}`}/>);
                        }

                        // json
                        if (data['application/json']) {
                            return (<pre><CodeHighlight content={data['application/json']} className="language-json"/></pre>);
                        }

                        // plain text
                        if (data['text/plain']) {
                            return (<p>{data['text/plain']}</p>);
                        }

                        // other data type
                        return (<pre><CodeHighlight content={JSON.stringify(data, null, 2)} className="language-json"/></pre>);
                    }

                    if (output.output_type === 'stream') {
                        return (<pre><CodeHighlight content={output.text} className="language-plaintext"/></pre>);
                    }

                    if (output.output_type === 'error') {
                        return (
                            <>
                                <pre><CodeHighlight content={`${output.ename}: ${output.evalue}`} className="language-plaintext"/></pre>
                                <Ansi content={(output.traceback || []).join('\n')}/>
                            </>
                        );
                    }

                    // unknown output_type
                    return (<pre><CodeHighlight content={JSON.stringify(output, null, 2)} className="language-json"/></pre>);
                })()
            }
        </div>
    );
};
